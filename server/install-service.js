const Service = require('node-windows').Service;
const path = require('path');

// Create a new service object
const svc = new Service({
    name: 'Remote PC Controller',
    description: 'Remote Shutdown, Restart and Wake on LAN Controller',
    script: path.resolve(__dirname, 'server.js'),
    env: [
        {
            name: "PORT",
            value: 3000
        },
        {
            name: "JWT_SECRET",
            value: "supersecretkey-remote-pc"
        }
    ]
});

// Listen for the "install" event, which indicates the
// process is available as a service.
svc.on('install', function () {
    console.log('Service installed successfully!');
    svc.start();
});

// Listen for the "alreadyinstalled" event
svc.on('alreadyinstalled', function () {
    console.log('Service is already installed.');
    svc.start();
});

// Install the service
console.log('Installing Windows Service...');
svc.install();
