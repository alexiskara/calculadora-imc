// ===== Navegação entre abas =====
function trocarAba(idAba, botao) {
    document.querySelectorAll('.tab-content').forEach(function (aba) {
        aba.classList.remove('active');
    });
    document.querySelectorAll('.tab-btn').forEach(function (btn) {
        btn.classList.remove('active');
    });
    document.getElementById(idAba).classList.add('active');
    botao.classList.add('active');
}

// ===== Funções auxiliares =====

// Aceita altura em metros (1.81) ou centímetros (181)
function normalizarAltura(valor) {
    if (valor > 3) {
        return valor / 100;
    }
    return valor;
}

function classificarIMC(imc) {
    if (imc < 17) {
        return { texto: 'Muito abaixo do peso', classe: 'alerta' };
    } else if (imc < 18.5) {
        return { texto: 'Abaixo do peso', classe: 'atencao' };
    } else if (imc < 25) {
        return { texto: 'Peso ideal', classe: 'ok' };
    } else if (imc < 30) {
        return { texto: 'Um pouco acima do peso (sobrepeso)', classe: 'atencao' };
    } else if (imc < 35) {
        return { texto: 'Acima do peso (Obesidade Grau 1)', classe: 'alerta' };
    } else if (imc < 40) {
        return { texto: 'Bem acima do peso (Obesidade Grau 2 - Severa)', classe: 'alerta' };
    } else {
        return { texto: 'Muito acima do peso (Obesidade Grau 3 - Mórbida)', classe: 'alerta' };
    }
}

function pesoIdealFaixa(altura) {
    return {
        minimo: 18.5 * altura * altura,
        maximo: 24.9 * altura * altura
    };
}

// ===== Dados compartilhados entre abas + salvamento no navegador =====
const CHAVE_STORAGE = 'imcProDados';

// Pares de campos que devem ficar sincronizados entre as abas
const camposSincronizados = [
    ['altura', 'alturaCal'],
    ['peso', 'pesoCal']
];

const camposSalvos = ['altura', 'peso', 'idade', 'sexo', 'atividade'];

function salvarDados() {
    const dados = {};
    camposSalvos.forEach(function (id) {
        dados[id] = document.getElementById(id).value;
    });
    try {
        localStorage.setItem(CHAVE_STORAGE, JSON.stringify(dados));
    } catch (e) {
        // localStorage indisponível (modo privado etc.) — segue sem salvar
    }
}

function restaurarDados() {
    let dados;
    try {
        dados = JSON.parse(localStorage.getItem(CHAVE_STORAGE));
    } catch (e) {
        return;
    }
    if (!dados) return;

    camposSalvos.forEach(function (id) {
        if (dados[id] !== undefined && dados[id] !== '') {
            document.getElementById(id).value = dados[id];
        }
    });
    // Reflete altura/peso na aba de calorias
    camposSincronizados.forEach(function (par) {
        document.getElementById(par[1]).value = document.getElementById(par[0]).value;
    });
}

function iniciarSincronizacao() {
    camposSincronizados.forEach(function (par) {
        const campoA = document.getElementById(par[0]);
        const campoB = document.getElementById(par[1]);
        campoA.addEventListener('input', function () {
            campoB.value = campoA.value;
            salvarDados();
        });
        campoB.addEventListener('input', function () {
            campoA.value = campoB.value;
            salvarDados();
        });
    });
    ['idade', 'sexo', 'atividade'].forEach(function (id) {
        document.getElementById(id).addEventListener('input', salvarDados);
    });
}

// Script carrega com defer, então o DOM já está pronto aqui
restaurarDados();
iniciarSincronizacao();

// ===== ABA 1: IMC =====
function calcularIMC() {
    const alturaInformada = parseFloat(document.getElementById('altura').value);
    const peso = parseFloat(document.getElementById('peso').value);
    const resultadoDiv = document.getElementById('resultado');

    if (isNaN(alturaInformada) || isNaN(peso) || alturaInformada <= 0 || peso <= 0) {
        resultadoDiv.innerHTML = '<span class="alerta">Por favor, insira valores válidos para altura e peso.</span>';
        return;
    }

    const altura = normalizarAltura(alturaInformada);
    const imc = peso / (altura * altura);
    const classificacao = classificarIMC(imc);
    const faixa = pesoIdealFaixa(altura);

    let mensagemPeso;
    if (peso < faixa.minimo) {
        mensagemPeso = `Você precisa <strong>ganhar ${(faixa.minimo - peso).toFixed(1)} kg</strong> para atingir o peso ideal.`;
    } else if (peso > faixa.maximo) {
        mensagemPeso = `Você precisa <strong>perder ${(peso - faixa.maximo).toFixed(1)} kg</strong> para atingir o peso ideal.`;
    } else {
        mensagemPeso = 'Parabéns! Você já está dentro da faixa de peso ideal.';
    }

    resultadoDiv.innerHTML = `
        <div class="imc-valor">Seu IMC: <strong>${imc.toFixed(2)}</strong></div>
        <div class="classificacao ${classificacao.classe}">${classificacao.texto}</div>
        <div class="peso-ideal">
            Peso ideal para sua altura: <strong>${faixa.minimo.toFixed(1)} kg a ${faixa.maximo.toFixed(1)} kg</strong>
        </div>
        <div class="mensagem">${mensagemPeso}</div>
    `;
}

// ===== ABA 2: CALORIAS =====

// Distribuição de macronutrientes: 30% proteína, 40% carboidrato, 30% gordura
function montarMacros(calorias) {
    const proteina = Math.round((calorias * 0.30) / 4); // 4 kcal por grama
    const carboidrato = Math.round((calorias * 0.40) / 4); // 4 kcal por grama
    const gordura = Math.round((calorias * 0.30) / 9); // 9 kcal por grama

    return `
        <div class="macros-titulo">Distribuição sugerida de macronutrientes:</div>
        <div class="macros">
            <div class="macro proteina">
                <div class="macro-nome">Proteínas</div>
                <div class="macro-valor">${proteina} g</div>
                <div class="macro-pct">30%</div>
            </div>
            <div class="macro carboidrato">
                <div class="macro-nome">Carboidratos</div>
                <div class="macro-valor">${carboidrato} g</div>
                <div class="macro-pct">40%</div>
            </div>
            <div class="macro gordura">
                <div class="macro-nome">Gorduras</div>
                <div class="macro-valor">${gordura} g</div>
                <div class="macro-pct">30%</div>
            </div>
        </div>
    `;
}

function calcularCalorias() {
    const alturaInformada = parseFloat(document.getElementById('alturaCal').value);
    const peso = parseFloat(document.getElementById('pesoCal').value);
    const idade = parseFloat(document.getElementById('idade').value);
    const sexo = document.getElementById('sexo').value;
    const fatorAtividade = parseFloat(document.getElementById('atividade').value);
    const resultadoDiv = document.getElementById('resultadoCalorias');

    if (isNaN(alturaInformada) || isNaN(peso) || isNaN(idade) || alturaInformada <= 0 || peso <= 0 || idade <= 0) {
        resultadoDiv.innerHTML = '<span class="alerta">Por favor, preencha altura, peso e idade com valores válidos.</span>';
        return;
    }

    const altura = normalizarAltura(alturaInformada);

    // Taxa Metabólica Basal (fórmula de Mifflin-St Jeor)
    const alturaCm = altura * 100;
    let tmb;
    if (sexo === 'masculino') {
        tmb = 10 * peso + 6.25 * alturaCm - 5 * idade + 5;
    } else {
        tmb = 10 * peso + 6.25 * alturaCm - 5 * idade - 161;
    }

    // Gasto calórico diário total (manutenção)
    const manutencao = tmb * fatorAtividade;

    const faixa = pesoIdealFaixa(altura);
    let objetivo;
    let caloriasAlvo;

    if (peso > faixa.maximo) {
        // Precisa perder peso: déficit de ~500 kcal/dia (~0,5 kg por semana)
        const kgPerder = peso - faixa.maximo;
        caloriasAlvo = manutencao - 500;
        const semanas = Math.ceil(kgPerder / 0.5);
        objetivo = `
            <div class="mensagem">Para chegar ao peso ideal você precisa <strong>perder ${kgPerder.toFixed(1)} kg</strong>.</div>
            <div class="calorias-alvo perder">Coma cerca de <strong>${Math.round(caloriasAlvo)} kcal/dia</strong></div>
            <div class="mensagem">Com esse déficit de ~500 kcal/dia, você perderia aproximadamente 0,5 kg por semana e atingiria o peso ideal em cerca de <strong>${semanas} semana(s)</strong>.</div>
        `;
    } else if (peso < faixa.minimo) {
        // Precisa ganhar peso: superávit de ~400 kcal/dia
        const kgGanhar = faixa.minimo - peso;
        caloriasAlvo = manutencao + 400;
        const semanas = Math.ceil(kgGanhar / 0.4);
        objetivo = `
            <div class="mensagem">Para chegar ao peso ideal você precisa <strong>ganhar ${kgGanhar.toFixed(1)} kg</strong>.</div>
            <div class="calorias-alvo ganhar">Coma cerca de <strong>${Math.round(caloriasAlvo)} kcal/dia</strong></div>
            <div class="mensagem">Com esse superávit de ~400 kcal/dia, você ganharia aproximadamente 0,4 kg por semana e atingiria o peso ideal em cerca de <strong>${semanas} semana(s)</strong>.</div>
        `;
    } else {
        caloriasAlvo = manutencao;
        objetivo = `
            <div class="mensagem">Você já está no peso ideal!</div>
            <div class="calorias-alvo manter">Para manter o peso, coma cerca de <strong>${Math.round(caloriasAlvo)} kcal/dia</strong></div>
        `;
    }

    resultadoDiv.innerHTML = `
        <div class="info-linha">Taxa Metabólica Basal (TMB): <strong>${Math.round(tmb)} kcal/dia</strong></div>
        <div class="info-linha">Gasto diário para manter o peso atual: <strong>${Math.round(manutencao)} kcal/dia</strong></div>
        <hr>
        ${objetivo}
        ${montarMacros(caloriasAlvo)}
        <div class="aviso">* Valores estimados. Consulte um nutricionista para um plano personalizado.</div>
    `;
}
