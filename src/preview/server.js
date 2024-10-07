import { readFileSync } from 'node:fs';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import watch from 'node-watch';
import { previewClient, getCssDoodleLib } from '../static.js';

const sourceFile = process.argv[2];
const cssDoodleLib = getCssDoodleLib();
const timers = {};

if (!sourceFile) {
    console.error('Usage: node server.js <source-file>');
    process.exit(1);
}

function read(file) {
    return readFileSync(file, 'utf8');
}

const httpServer = createServer((req, res) => {
    let route= req.url.split('?')[0];
    switch (route) {
        case '/':
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(previewClient);
            break;
        case '/css-doodle':
            res.writeHead(200, {
                'Content-Type': 'application/javascript' ,
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': '*',
            });
            res.end(cssDoodleLib);
            break;
        case '/favicon.ico':
            res.writeHead(204);
            res.end();
            break;
        default:
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
    }
});

const wsServer = new WebSocketServer({
    server: httpServer
});

function pendingClose(instance, fn, timeout = 1000) {
    timers[instance] = setTimeout(fn, timeout);
}

wsServer.on('connection', (ws, req) => {
    let query = new URLSearchParams(req.url.split('?')[1]);
    const watcher = watch(sourceFile);

    ws.send(JSON.stringify({
        type: 'update',
        data: read(sourceFile)
    }));

    ws.on('error', e => {
        console.error(e.message);
    });

    ws.on('message', (e) => {
        let input = {};
        try {
            input = JSON.parse(e);
        } catch(e) {
            console.error(e.message);
        }
        if (input.type === 'ping') {
            clearTimeout(timers[query.get('instance')]);
        }
    });

    ws.on('close', () => {
        pendingClose(query.get('instance'), () => {
            watcher.close();
            httpServer.close();
            wsServer.close();
            if (process.send) {
                process.send({ exit: true });
            }
        });
    });

    watcher.on('change', (event, filename) => {
        if (event === 'update') {
            ws.send(JSON.stringify({
                type: 'update',
                data: read(sourceFile)
            }));
        }
    });
});

httpServer.listen(0, () => {
    const port = httpServer.address().port;
    if (process.send) {
        process.send({ url: 'http://localhost:' + port });
    }
});
