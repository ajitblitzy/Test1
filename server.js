const http = require('http');
const router = require('./src/router');
const config = require('./src/config');

const hostname = config.hostname;
const port = config.port;

const server = http.createServer((req, res) => {
  router.handle(req, res);
});

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
  console.log('Staging-approval workflow is active');
});
