"""Serveur local avec une boucle réseau compatible Windows/Python 3.14."""
import argparse

import uvicorn


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    # Le service local ne lance pas de sous-processus asyncio. Selector évite
    # WinError 10022 à la fermeture des sockets Proactor sous Python 3.14.
    uvicorn.run("app.main:create_app", factory=True, host=args.host, port=args.port,
                loop="asyncio:SelectorEventLoop")


if __name__ == "__main__":
    main()
