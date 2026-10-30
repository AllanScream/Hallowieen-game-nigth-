# Local launcher for the packed game (copied next to the game/ folder as serve.py).
# Serves game/ on the first FREE port (each version starts from its own port), with caching off, and opens the browser.
# The port is taken exclusively, so an old version's server still running elsewhere can never answer instead of this one.
import functools, http.server, os, socket, sys, threading, webbrowser

VERSION, FIRST_PORT = 'v12.1', 8012
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'game')


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = dict(http.server.SimpleHTTPRequestHandler.extensions_map, **{'.webp': 'image/webp', '.mp3': 'audio/mpeg', '.js': 'text/javascript'})   # Windows registry may lack these
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        super().end_headers()

    def log_message(self, *args):
        pass


class Server(http.server.ThreadingHTTPServer):
    allow_reuse_address = False

    def server_bind(self):
        if hasattr(socket, 'SO_EXCLUSIVEADDRUSE'):          # Windows: refuse a port another server already holds
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()


def main():
    handler = functools.partial(Handler, directory=ROOT)
    for port in range(FIRST_PORT, FIRST_PORT + 100):
        try:
            httpd = Server(('127.0.0.1', port), handler)
            break
        except OSError:
            continue
    else:
        print('Не нашёл свободный порт. Закройте старые окна сервера игры и запустите снова.')
        return 1
    url = f'http://127.0.0.1:{port}/index.html'
    print(f'«Сладость или гадость» {VERSION}: {url}')
    print('Не закрывайте это окно, пока играете. Закрыть сервер: Ctrl+C или крестик окна.')
    threading.Timer(1.0, lambda: webbrowser.open(url)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    return 0


if __name__ == '__main__':
    sys.exit(main())
