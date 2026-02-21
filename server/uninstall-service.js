const Service = require('node-windows').Service;
const path = require('path');

const svc = new Service({
    name: 'Remote PC Controller',
    script: path.resolve(__dirname, 'server.js')
});

svc.on('uninstall', function () {
    console.log('Uninstall complete.');
    console.log('The service exists: ', svc.exists);
});

svc.uninstall();
