"""Serveur local avec une boucle réseau compatible Windows/Python 3.14."""
import argparse

import uvicorn


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--local", action="store_true", help="Espace personnel SQLite sans hébergement")
    args = parser.parse_args()
    # Le service local ne lance pas de sous-processus asyncio. Selector évite
    # WinError 10022 à la fermeture des sockets Proactor sous Python 3.14.
    if args.local:
        from pathlib import Path
        from desktop_entry import prepare
        from .main import create_app
        settings = prepare(Path(".local/private"), "")
        settings.cors_origins = ["http://127.0.0.1:1420", "http://localhost:1420", "http://tauri.localhost", "tauri://localhost"]
        app = create_app(settings)
    else:
        app = "app.main:create_app"
    uvicorn.run(app, factory=not args.local, host="127.0.0.1" if args.local else args.host, port=args.port,
                loop="asyncio:SelectorEventLoop")


if __name__ == "__main__":
    main()
