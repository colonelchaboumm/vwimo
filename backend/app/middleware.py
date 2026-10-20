from tempfile import SpooledTemporaryFile

from starlette.responses import JSONResponse


class BodyLimitMiddleware:
    """Limiter aussi les uploads chunked avant leur parsing multipart."""
    def __init__(self, app, maximum=16 * 1024 * 1024):
        self.app, self.maximum = app, maximum

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["method"] not in ("POST", "PUT", "PATCH"):
            return await self.app(scope, receive, send)
        headers = dict(scope.get("headers", []))
        try:
            declared = int(headers.get(b"content-length", b"0"))
        except ValueError:
            return await JSONResponse({"detail": "Taille de requête invalide."}, 400)(scope, receive, send)
        if declared > self.maximum:
            return await JSONResponse({"detail": "La requête dépasse 16 Mo."}, 413)(scope, receive, send)
        with SpooledTemporaryFile(max_size=1024 * 1024) as body:
            size = 0
            while True:
                message = await receive()
                if message["type"] == "http.disconnect":
                    return
                chunk = message.get("body", b"")
                size += len(chunk)
                if size > self.maximum:
                    return await JSONResponse({"detail": "La requête dépasse 16 Mo."}, 413)(scope, receive, send)
                body.write(chunk)
                if not message.get("more_body", False):
                    break
            body.seek(0)
            delivered = False

            async def limited_receive():
                nonlocal delivered
                if delivered:
                    return await receive()
                chunk = body.read(64 * 1024)
                more = body.tell() < size
                delivered = not more
                return {"type": "http.request", "body": chunk, "more_body": more}

            await self.app(scope, limited_receive, send)
