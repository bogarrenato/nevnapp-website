# Nevnap API

Compatibility API for the mobile app notification endpoints.

The service is intended to run isolated on the VPS as a Docker Compose project:

- API: `127.0.0.1:5201`
- Database: private Postgres container
- Public route: Nginx proxy such as `/nevnap-api/`

Supported endpoints:

- `GET /health`
- `POST /register-device`
- `POST /unregister-device`
- `POST /subscribe`
- `POST /unsubscribe`
- `POST /receipt`
- `POST /store-notifications`

The server also accepts prefixed paths such as `/nevnap-api/register-device` or
`/prod/register-device` because routing is based on the final path segment.
