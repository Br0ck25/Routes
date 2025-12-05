function withCors(resp, req) {
	const allowedOrigins = ['https://gorouteyourself.com', 'https://betaroute.brocksville.com'];
	const origin = req.headers.get('Origin');

	if (allowedOrigins.includes(origin)) {
		resp.headers.set('Access-Control-Allow-Origin', origin);
	}

	resp.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
	resp.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
	resp.headers.set('Access-Control-Max-Age', '86400');

	return resp;
}

async function hashPassword(password) {
	const encoder = new TextEncoder();
	const data = encoder.encode(password);
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	return [...new Uint8Array(hashBuffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default {
	async fetch(request, env, ctx) {
		try {
			const url = new URL(request.url);
			const { pathname } = url;

			if (request.method === 'OPTIONS') {
				return withCors(new Response(null, { status: 204 }), request);
			}

			const json = async () => await request.json().catch(() => ({}));
			const getUserKey = (username) => `user:${username}`;
			const getLogsKey = (token) => `logs:${token}`;

			if (pathname === '/api/signup' && request.method === 'POST') {
				const { username, password } = await json();
				const userKey = getUserKey(username);
				if (await env.LOGS_KV.get(userKey)) {
					return withCors(Response.json({ error: 'That username is already taken. Please choose another.' }, { status: 400 }), request);
				}

				const token = crypto.randomUUID();
				const resetKey = crypto.randomUUID();
				const hashedPassword = await hashPassword(password);
				await env.LOGS_KV.put(
					userKey,
					JSON.stringify({
						password: hashedPassword,
						token,
						resetKey,
						createdAt: new Date().toISOString(),
					})
				);

				return withCors(Response.json({ token, resetKey }), request);
			}

			if (pathname === '/api/login' && request.method === 'POST') {
				const { username, password } = await json();
				const userKey = getUserKey(username);
				const data = await env.LOGS_KV.get(userKey);
				if (!data) {
					return withCors(new Response('User not found', { status: 404 }), request);
				}

				const user = JSON.parse(data);
				const hashedPassword = await hashPassword(password);

				// Auto-upgrade from plaintext if needed
				if (user.password === password) {
					user.password = hashedPassword;
					await env.LOGS_KV.put(userKey, JSON.stringify(user));
				}

				if (user.password !== hashedPassword) {
					return withCors(new Response('Invalid password', { status: 403 }), request);
				}

				return withCors(Response.json({ token: user.token }), request);
			}

			if (pathname === '/api/google-login' && request.method === 'POST') {
				const { id_token } = await json();
				if (!id_token) {
					return withCors(new Response('Missing ID token', { status: 400 }), request);
				}

				// Verify token with Google
				const verifyResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${id_token}`);

				if (!verifyResponse.ok) {
					return withCors(new Response('Invalid Google token', { status: 403 }), request);
				}

				const profile = await verifyResponse.json();
				const email = profile.email;
				const name = profile.name || email;

				const userKey = getUserKey(email);
				let user = await env.LOGS_KV.get(userKey);

				if (!user) {
					// New user — register automatically
					const token = crypto.randomUUID();
					const resetKey = crypto.randomUUID();
					user = {
						token,
						resetKey,
						createdAt: new Date().toISOString(),
						google: true,
					};
					await env.LOGS_KV.put(userKey, JSON.stringify(user));
				} else {
					user = JSON.parse(user);
				}

				return withCors(
					Response.json({
						token: user.token,
						username: name,
					}),
					request
				);
			}

			if (pathname === '/api/change-password' && request.method === 'POST') {
				const { username, currentPassword, newPassword } = await json();
				const userKey = getUserKey(username);
				const data = await env.LOGS_KV.get(userKey);
				if (!data) {
					return withCors(new Response('User not found', { status: 404 }), request);
				}

				const user = JSON.parse(data);
				const token = request.headers.get('Authorization');
				const hashedCurrent = await hashPassword(currentPassword);

				if (user.token !== token || (user.password !== currentPassword && user.password !== hashedCurrent)) {
					return withCors(new Response('Unauthorized', { status: 403 }), request);
				}

				user.password = await hashPassword(newPassword);
				await env.LOGS_KV.put(userKey, JSON.stringify(user));
				return withCors(new Response('Password changed'), request);
			}

			if (pathname === '/api/reset-password' && request.method === 'POST') {
				const { username, resetKey, newPassword } = await json();
				const userKey = getUserKey(username);
				const data = await env.LOGS_KV.get(userKey);
				if (!data) return withCors(new Response('User not found', { status: 404 }), request);
				const user = JSON.parse(data);
				if (user.resetKey !== resetKey) return withCors(new Response('Invalid reset key', { status: 403 }), request);
				user.password = await hashPassword(newPassword);
				await env.LOGS_KV.put(userKey, JSON.stringify(user));
				return withCors(new Response('Password reset'), request);
			}

			if (pathname === '/api/delete-account' && request.method === 'POST') {
				const { username, password } = await json();
				const userKey = getUserKey(username);
				const data = await env.LOGS_KV.get(userKey);
				if (!data) return withCors(new Response('User not found', { status: 404 }), request);
				const user = JSON.parse(data);
				const token = request.headers.get('Authorization');
				const hashedPassword = await hashPassword(password);

				if (user.token !== token || user.password !== hashedPassword) {
					return withCors(new Response('Unauthorized', { status: 403 }), request);
				}

				await env.LOGS_KV.delete(userKey);
				await env.LOGS_KV.delete(getLogsKey(user.token));
				return withCors(new Response('Account deleted'), request);
			}

			if (pathname === '/logs' && request.method === 'GET') {
				const token = request.headers.get('Authorization');
				if (!token) return withCors(new Response('Missing token', { status: 401 }), request);
				const logs = await env.LOGS_KV.get(getLogsKey(token));
				return withCors(
					new Response(logs || '[]', {
						headers: { 'Content-Type': 'application/json' },
					}),
					request
				);
			}

			if (pathname === '/logs' && request.method === 'POST') {
				const token = request.headers.get('Authorization');
				if (!token) return withCors(new Response('Missing token', { status: 401 }), request);
				const body = await request.text();
				await env.LOGS_KV.put(getLogsKey(token), body);
				return withCors(new Response('Logs saved'), request);
			}

			if (pathname === '/' || pathname === '/index.html') {
				const html = await env.ASSETS.get('index.html');

				if (!html) return new Response('index.html not found', { status: 404 });

				const headers = new Headers({ 'Content-Type': 'text/html; charset=utf-8' });
				headers.set('Cache-Control', 'no-store'); // ✅ this is missing
				headers.delete('Cross-Origin-Opener-Policy');
				headers.delete('Cross-Origin-Embedder-Policy');

				return new Response(html, { headers });
			}

			if (pathname === '/admin/users' && request.method === 'GET') {
				if (url.searchParams.get('adminToken') !== env.ADMIN_TOKEN) {
					return new Response('Unauthorized', { status: 403 });
				}
				const list = await env.LOGS_KV.list({ prefix: 'user:' });
				const users = list.keys.map((k) => k.name.replace(/^user:/, ''));

				const html = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Admin Panel - Go Route Yourself</title>
    



<style>
  body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    background-color: #f4f6f9;
    margin: 0;
    padding: 20px;
    box-sizing: border-box;
  }

  h1 {
    text-align: center;
    color: #333;
    margin-bottom: 20px;
    font-size: 22px;
  }

  .summary {
    background: white;
    max-width: 600px;
    margin: 0 auto 20px auto;
    padding: 15px;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
    font-size: 16px;
  }

  .table-wrapper {
    max-width: 600px;
    margin: 0 auto;
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    background: white;
    box-shadow: 0 2px 10px rgba(0,0,0,0.05);
    border-radius: 8px;
    overflow: hidden;
    min-width: 400px;
  }

  th, td {
    padding: 12px 14px;
    text-align: left;
    white-space: nowrap;
  }

  th {
    background-color: #007bff;
    color: white;
    font-weight: 600;
  }

  tr:nth-child(even) {
    background-color: #f9f9f9;
  }

  td button {
    margin: 4px 4px 4px 0;
    padding: 6px 10px;
    font-size: 14px;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    color: white;
    display: inline-block;
  }

  button.danger {
    background-color: #dc3545;
  }

  button.danger:hover {
    background-color: #a71d2a;
  }

  button.reset {
    background-color: #17a2b8;
  }

  button.reset:hover {
    background-color: #117a8b;
  }

  @media (max-width: 600px) {
    th, td {
      font-size: 14px;
    }

    td button {
      display: block;
      width: 100%;
      margin: 6px 0;
    }

    .summary {
      font-size: 14px;
      padding: 12px;
    }

    h1 {
      font-size: 20px;
    }
  }
footer {
  text-align: center;
  margin-top: 40px;
  font-size: 14px;
  color: #666;
}

</style>





  </head>
  <body>
    <h1>🛠 Admin Panel — Registered Users</h1>
<div class="table-wrapper">
    <table>
      <tr><th>Username</th><th>Actions</th></tr>
      ${users
				.map(
					(user) => `
        <tr>
          <td>${user}</td>
          <td>
            <button class="danger" onclick="deleteUser('${user}')">Delete</button>
            <button class="reset" onclick="resetUser('${user}')">Reset Password</button> <!-- ✅ -->
          </td>
        </tr>
      `
				)
				.join('')}
    </table>

    <footer>Go Route Yourself Admin • ${new Date().getFullYear()}</footer>

    <script>
      async function deleteUser(username) {
        if (!confirm("Delete user " + username + "?")) return;
        const res = await fetch("/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "delete", username })
        });
        alert(await res.text());
        location.reload();
      }

      async function resetUser(username) {
        const tempPassword = prompt("Enter a temporary password for " + username);
        if (!tempPassword) return;
        const res = await fetch("/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "reset-password", username, tempPassword })
        });
        alert(await res.text());
      }
    </script>
  </body>
</html>
`;

				return new Response(html, {
					headers: { 'Content-Type': 'text/html; charset=utf-8' },
				});
			}

			if (pathname === '/admin/users' && request.method === 'POST') {
				if (url.searchParams.get('adminToken') !== env.ADMIN_TOKEN) {
					return new Response('Unauthorized', { status: 403 });
				}

				const { action, username, tempPassword } = await json();
				const userKey = `user:${username}`;
				const userData = await env.LOGS_KV.get(userKey);
				if (!userData) return new Response('User not found', { status: 404 });

				const user = JSON.parse(userData);

				if (action === 'delete') {
					await env.LOGS_KV.delete(userKey);
					await env.LOGS_KV.delete(`logs:${user.token}`);
					return new Response('✅ User deleted');
				}

				if (action === 'reset-password' && tempPassword) {
					user.password = await hashPassword(tempPassword);
					await env.LOGS_KV.put(userKey, JSON.stringify(user));
					return new Response('✅ Password reset');
				}

				return new Response('❌ Invalid action', { status: 400 });
			}

			const staticAsset = await env.ASSETS.get(pathname.slice(1));
			if (staticAsset) {
				let contentType = 'application/octet-stream';
				if (pathname.endsWith('.html')) contentType = 'text/html; charset=utf-8';
				else if (pathname.endsWith('.json')) contentType = 'application/json';
				else if (pathname.endsWith('.png')) contentType = 'image/png';
				else if (pathname.endsWith('.svg')) contentType = 'image/svg+xml';
				else if (pathname.endsWith('.js')) contentType = 'application/javascript';

				const headers = new Headers({ 'Content-Type': contentType });

				if (contentType.startsWith('text/html')) {
					headers.set('Cache-Control', 'no-store');
					headers.delete('Cross-Origin-Opener-Policy');
					headers.delete('Cross-Origin-Embedder-Policy');
				}

				return new Response(staticAsset, { headers });
			}

			return withCors(new Response('Not found', { status: 404 }), request);
		} catch (err) {
			return withCors(Response.json({ error: 'Internal Server Error' }, { status: 500 }), request);
		}
	},
};
