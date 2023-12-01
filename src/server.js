var http = require('http');

export const initServer = (port, evmProvider, nonce$, chain) => {
    let nonce;
    nonce$.subscribe(n => nonce = n);
    http.createServer(function (req, res) {
        const val = {chain, nonce, conn: evmProvider.api.isConnected}
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.write(JSON.stringify(val));
        res.end();
    }).listen(port);
}
