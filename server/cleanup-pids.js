const { exec } = require('child_process');

console.log('Iniciando limpeza de processos residuais...');

// Lista de processos para encerrar
const processes = ['remotepccontroller.exe', 'node.exe'];

processes.forEach(proc => {
    exec(`taskkill /F /IM ${proc} /T`, (err, stdout, stderr) => {
        if (err) {
            console.log(`Aviso: Processo ${proc} não estava em execução ou não pudo ser encerrado.`);
        } else {
            console.log(`Sucesso: Processo ${proc} encerrado.`);
        }
    });
});

console.log('Limpeza concluída. Agora você pode tentar instalar novamente.');
