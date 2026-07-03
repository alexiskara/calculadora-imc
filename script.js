/*
 * TODO — Integrações futuras (combinadas, aguardando contas/chaves do Alexis):
 *
 * 6) SINCRONIZAÇÃO NA NUVEM (Firebase)
 *    Login com Google e sincronização do histórico de peso, diário alimentar
 *    e configurações entre dispositivos (hoje tudo vive no localStorage de
 *    cada navegador). Requer: criar projeto no console do Firebase
 *    (https://console.firebase.google.com) com Authentication (Google) e
 *    Firestore, e colar aqui a config do SDK web.
 *
 * 7) SUGESTÕES COM IA (API do Claude)
 *    Gerar plano alimentar do dia a partir da meta calórica e dos macros
 *    calculados. Requer: chave da API da Anthropic e um pequeno backend
 *    (ex.: Cloudflare Worker ou função no Vercel) para guardar a chave —
 *    ela não pode ficar exposta no código deste site público.
 */

// ===== PWA: registra o service worker (modo offline / app instalável) =====
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
        navigator.serviceWorker.register('sw.js').catch(function () {
            // sem service worker (ex.: aberto direto do arquivo), o app segue normal
        });
    });
}

// ===== Navegação entre abas =====
function trocarAba(idAba, botao) {
    document.querySelectorAll('.tab-content').forEach(function (aba) {
        aba.classList.remove('active');
    });
    document.querySelectorAll('.tab-btn').forEach(function (btn) {
        btn.classList.remove('active');
        btn.setAttribute('aria-selected', 'false');
    });
    document.getElementById(idAba).classList.add('active');
    botao.classList.add('active');
    botao.setAttribute('aria-selected', 'true');
}

// ===== Funções auxiliares =====

// Aceita altura em metros (1.81) ou centímetros (181)
function normalizarAltura(valor) {
    if (valor > 3) {
        return valor / 100;
    }
    return valor;
}

// Valida os campos e retorna a lista de erros encontrados
function validarMedidas(altura, peso) {
    const erros = [];
    if (isNaN(altura) || altura < 0.5 || altura > 2.5) {
        erros.push('Altura deve estar entre 0,50 m e 2,50 m (ou 50 e 250 cm).');
    }
    if (isNaN(peso) || peso < 20 || peso > 400) {
        erros.push('Peso deve estar entre 20 kg e 400 kg.');
    }
    return erros;
}

function mensagemErros(erros) {
    return '<div class="classificacao alerta">' + erros.join('<br>') + '</div>';
}

function escapeHTML(texto) {
    const div = document.createElement('div');
    div.textContent = texto;
    return div.innerHTML;
}

function lerStorage(chave) {
    try {
        return localStorage.getItem(chave);
    } catch (e) {
        return null;
    }
}

function gravarStorage(chave, valor) {
    try {
        localStorage.setItem(chave, valor);
    } catch (e) {
        // localStorage indisponível (modo privado etc.) — segue sem salvar
    }
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

// Barra visual do IMC: escala de 15 a 40, com divisões em 18.5, 25 e 30
function montarBarraIMC(imc) {
    const ESCALA_MIN = 15;
    const ESCALA_MAX = 40;
    const posicao = Math.min(Math.max((imc - ESCALA_MIN) / (ESCALA_MAX - ESCALA_MIN), 0), 1) * 100;

    return `
        <div class="imc-barra">
            <div class="imc-barra-track">
                <div class="imc-barra-marcador" style="left: ${posicao.toFixed(1)}%"></div>
            </div>
            <div class="imc-barra-legendas">
                <span style="left: 14%">18,5</span>
                <span style="left: 40%">25</span>
                <span style="left: 60%">30</span>
            </div>
            <div class="imc-barra-nomes">
                <span class="nome-abaixo">Abaixo</span>
                <span class="nome-ideal">Ideal</span>
                <span class="nome-sobre">Sobrepeso</span>
                <span class="nome-obesidade">Obesidade</span>
            </div>
        </div>
    `;
}

// Estima a data em que a meta será atingida
function dataEstimada(semanas) {
    const data = new Date();
    data.setDate(data.getDate() + semanas * 7);
    const texto = data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return 'aproximadamente em ' + texto;
}

// ===== Compartilhamento (Web Share API, com cópia como alternativa) =====
const URL_APP = 'https://alexiskara.github.io/calculadora-imc/';
const textosCompartilhar = { imc: '', calorias: '' };

function botaoCompartilhar(tipo) {
    return `<button type="button" class="btn-compartilhar" onclick="compartilhar('${tipo}')">Compartilhar resultado</button>`;
}

function compartilhar(tipo) {
    const texto = textosCompartilhar[tipo];
    if (!texto) return;
    const completo = texto + '\n\nCalculado em ' + URL_APP;

    if (navigator.share) {
        navigator.share({ text: completo }).catch(function () {
            // usuário cancelou o compartilhamento
        });
        return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(completo).then(function () {
            alert('Resultado copiado! Cole onde quiser compartilhar.');
        });
        return;
    }
    window.open('https://wa.me/?text=' + encodeURIComponent(completo), '_blank');
}

// ===== Dados compartilhados entre abas + salvamento no navegador =====
const CHAVE_STORAGE = 'imcProDados';
const CHAVE_HISTORICO = 'imcProHistorico';
const CHAVE_META = 'imcProMeta';
const CHAVE_DIARIO = 'imcProDiario';
const CHAVE_LEMBRETE = 'imcProLembrete';
const CHAVE_ULTIMA_NOTIFICACAO = 'imcProUltimaNotif';

// Grupos de campos que devem ficar sincronizados entre as abas
const camposSincronizados = [
    ['altura', 'alturaCal'],
    ['peso', 'pesoCal', 'pesoHistorico']
];

const camposSalvos = ['altura', 'peso', 'idade', 'sexo', 'atividade', 'metaPeso', 'ritmo'];

function salvarDados() {
    const dados = {};
    camposSalvos.forEach(function (id) {
        dados[id] = document.getElementById(id).value;
    });
    gravarStorage(CHAVE_STORAGE, JSON.stringify(dados));
}

function restaurarDados() {
    let dados;
    try {
        dados = JSON.parse(lerStorage(CHAVE_STORAGE));
    } catch (e) {
        return;
    }
    if (!dados) return;

    camposSalvos.forEach(function (id) {
        if (dados[id] !== undefined && dados[id] !== '') {
            document.getElementById(id).value = dados[id];
        }
    });
    // Reflete os valores nos campos espelhados das outras abas
    camposSincronizados.forEach(function (grupo) {
        for (let i = 1; i < grupo.length; i++) {
            document.getElementById(grupo[i]).value = document.getElementById(grupo[0]).value;
        }
    });
}

function iniciarSincronizacao() {
    camposSincronizados.forEach(function (grupo) {
        grupo.forEach(function (idOrigem) {
            document.getElementById(idOrigem).addEventListener('input', function () {
                grupo.forEach(function (idDestino) {
                    if (idDestino !== idOrigem) {
                        document.getElementById(idDestino).value = document.getElementById(idOrigem).value;
                    }
                });
                salvarDados();
                // Peso alterado → meta de água e equivalências mudam
                if (grupo.indexOf('peso') !== -1) {
                    renderizarDiario();
                }
            });
        });
    });
    ['idade', 'sexo', 'atividade', 'metaPeso', 'ritmo'].forEach(function (id) {
        document.getElementById(id).addEventListener('input', salvarDados);
    });
}

function limparDados() {
    if (!confirm('Isso vai apagar todos os dados salvos, inclusive o histórico de peso e o diário alimentar. Deseja continuar?')) {
        return;
    }
    [CHAVE_STORAGE, CHAVE_HISTORICO, CHAVE_META, CHAVE_DIARIO, CHAVE_LEMBRETE, CHAVE_ULTIMA_NOTIFICACAO].forEach(function (chave) {
        try {
            localStorage.removeItem(chave);
        } catch (e) {
            // sem localStorage, nada a limpar
        }
    });
    document.querySelectorAll('input').forEach(function (campo) {
        if (campo.type !== 'file') campo.value = '';
    });
    document.getElementById('sexo').selectedIndex = 0;
    document.getElementById('atividade').selectedIndex = 0;
    document.getElementById('ritmo').selectedIndex = 1;
    document.getElementById('lembreteAtivo').checked = false;
    document.getElementById('resultado').innerHTML = '';
    document.getElementById('resultadoCalorias').innerHTML = '';
    document.getElementById('resultadosBusca').innerHTML = '';
    renderizarHistorico();
    renderizarDiario();
    verificarLembrete();
}

// ===== ABA 1: IMC =====
function calcularIMC() {
    const alturaInformada = parseFloat(document.getElementById('altura').value);
    const peso = parseFloat(document.getElementById('peso').value);
    const resultadoDiv = document.getElementById('resultado');

    const altura = normalizarAltura(alturaInformada);
    const erros = validarMedidas(altura, peso);
    if (erros.length > 0) {
        resultadoDiv.innerHTML = mensagemErros(erros);
        return;
    }

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

    textosCompartilhar.imc = `Meu IMC é ${imc.toFixed(2)} (${classificacao.texto}). ` +
        `A faixa de peso ideal para minha altura é de ${faixa.minimo.toFixed(1)} kg a ${faixa.maximo.toFixed(1)} kg.`;

    resultadoDiv.innerHTML = `
        <div class="imc-valor">Seu IMC: <strong>${imc.toFixed(2)}</strong></div>
        <div class="classificacao ${classificacao.classe}">${classificacao.texto}</div>
        ${montarBarraIMC(imc)}
        <div class="peso-ideal">
            Peso ideal para sua altura: <strong>${faixa.minimo.toFixed(1)} kg a ${faixa.maximo.toFixed(1)} kg</strong>
        </div>
        <div class="mensagem">${mensagemPeso}</div>
        ${botaoCompartilhar('imc')}
        <div class="aviso">* O IMC é uma referência para adultos e não substitui avaliação médica.</div>
    `;
}

// ===== ABA 2: CALORIAS =====

// Distribuição de macronutrientes: 30% proteína, 40% carboidrato, 30% gordura
function metasMacros(calorias) {
    return {
        proteina: Math.round((calorias * 0.30) / 4), // 4 kcal por grama
        carboidrato: Math.round((calorias * 0.40) / 4), // 4 kcal por grama
        gordura: Math.round((calorias * 0.30) / 9) // 9 kcal por grama
    };
}

function montarMacros(calorias) {
    const m = metasMacros(calorias);
    return `
        <div class="macros-titulo">Distribuição sugerida de macronutrientes:</div>
        <div class="macros">
            <div class="macro proteina">
                <div class="macro-nome">Proteínas</div>
                <div class="macro-valor">${m.proteina} g</div>
                <div class="macro-pct">30%</div>
            </div>
            <div class="macro carboidrato">
                <div class="macro-nome">Carboidratos</div>
                <div class="macro-valor">${m.carboidrato} g</div>
                <div class="macro-pct">40%</div>
            </div>
            <div class="macro gordura">
                <div class="macro-nome">Gorduras</div>
                <div class="macro-valor">${m.gordura} g</div>
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
    const ritmoSemanal = parseFloat(document.getElementById('ritmo').value); // kg por semana
    const metaInformada = parseFloat(document.getElementById('metaPeso').value);
    const resultadoDiv = document.getElementById('resultadoCalorias');

    const altura = normalizarAltura(alturaInformada);
    const erros = validarMedidas(altura, peso);
    if (isNaN(idade) || idade < 10 || idade > 120) {
        erros.push('Idade deve estar entre 10 e 120 anos.');
    }
    if (erros.length > 0) {
        resultadoDiv.innerHTML = mensagemErros(erros);
        return;
    }

    let avisos = '';
    if (idade < 18) {
        avisos += '<div class="classificacao atencao">Atenção: os cálculos de IMC e calorias desta ferramenta valem para adultos. Para menores de 18 anos, procure um pediatra ou nutricionista.</div>';
    }

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

    // Piso de segurança: não recomendar menos que isso por dia
    const pisoCalorico = sexo === 'masculino' ? 1500 : 1200;

    // Define o peso alvo: meta personalizada ou faixa de peso ideal
    const faixa = pesoIdealFaixa(altura);
    let pesoAlvo;
    let usandoMeta = false;

    if (!isNaN(metaInformada)) {
        if (metaInformada < 20 || metaInformada > 400) {
            resultadoDiv.innerHTML = mensagemErros(['Peso desejado deve estar entre 20 kg e 400 kg.']);
            return;
        }
        pesoAlvo = metaInformada;
        usandoMeta = true;
        const imcMeta = metaInformada / (altura * altura);
        if (imcMeta < 18.5) {
            avisos += `<div class="classificacao alerta">Cuidado: o peso desejado (${metaInformada.toFixed(1)} kg) resulta em IMC ${imcMeta.toFixed(1)}, abaixo do saudável. O mínimo recomendado para sua altura é ${faixa.minimo.toFixed(1)} kg.</div>`;
        } else if (imcMeta > 24.9) {
            avisos += `<div class="classificacao atencao">Observação: o peso desejado (${metaInformada.toFixed(1)} kg) resulta em IMC ${imcMeta.toFixed(1)}, acima da faixa ideal (o máximo recomendado é ${faixa.maximo.toFixed(1)} kg).</div>`;
        }
    } else if (peso > faixa.maximo) {
        pesoAlvo = faixa.maximo;
    } else if (peso < faixa.minimo) {
        pesoAlvo = faixa.minimo;
    } else {
        pesoAlvo = peso;
    }

    const rotuloAlvo = usandoMeta ? 'ao peso desejado' : 'ao peso ideal';

    // ~7700 kcal equivalem a 1 kg de gordura corporal
    const ajusteDiario = Math.round((ritmoSemanal * 7700) / 7);

    let objetivo;
    let caloriasAlvo;
    let resumoCompartilhar;

    if (pesoAlvo < peso - 0.05) {
        // Perder peso
        const kgPerder = peso - pesoAlvo;
        caloriasAlvo = manutencao - ajusteDiario;
        let ritmoReal = ritmoSemanal;
        let notaPiso = '';

        if (caloriasAlvo < pisoCalorico) {
            caloriasAlvo = pisoCalorico;
            const deficitReal = manutencao - pisoCalorico;
            ritmoReal = Math.max((deficitReal * 7) / 7700, 0);
            if (ritmoReal < 0.05) {
                resultadoDiv.innerHTML = avisos + `
                    <div class="info-linha">Gasto diário para manter o peso atual: <strong>${Math.round(manutencao)} kcal/dia</strong></div>
                    <div class="classificacao alerta">Seu gasto diário está muito próximo do mínimo calórico seguro (${pisoCalorico} kcal/dia). Não é possível recomendar um déficit com segurança — procure um nutricionista.</div>
                `;
                return;
            }
            notaPiso = `<div class="classificacao atencao">O ritmo escolhido exigiria menos que o mínimo seguro de ${pisoCalorico} kcal/dia. Ajustamos para esse mínimo, o que reduz o ritmo para ~${ritmoReal.toFixed(2)} kg por semana.</div>`;
        }

        const semanas = Math.ceil(kgPerder / ritmoReal);
        objetivo = `
            ${notaPiso}
            <div class="mensagem">Para chegar ${rotuloAlvo} você precisa <strong>perder ${kgPerder.toFixed(1)} kg</strong>.</div>
            <div class="calorias-alvo perder">Coma cerca de <strong>${Math.round(caloriasAlvo)} kcal/dia</strong></div>
            <div class="mensagem">Nesse ritmo (~${ritmoReal.toFixed(2)} kg/semana), você atingiria a meta em cerca de <strong>${semanas} semana(s)</strong> — ${dataEstimada(semanas)}.</div>
        `;
        resumoCompartilhar = `Para perder ${kgPerder.toFixed(1)} kg e chegar ${rotuloAlvo}, preciso comer cerca de ${Math.round(caloriasAlvo)} kcal/dia. Meta prevista para daqui a ${semanas} semana(s).`;
    } else if (pesoAlvo > peso + 0.05) {
        // Ganhar peso
        const kgGanhar = pesoAlvo - peso;
        caloriasAlvo = manutencao + ajusteDiario;
        const semanas = Math.ceil(kgGanhar / ritmoSemanal);
        objetivo = `
            <div class="mensagem">Para chegar ${rotuloAlvo} você precisa <strong>ganhar ${kgGanhar.toFixed(1)} kg</strong>.</div>
            <div class="calorias-alvo ganhar">Coma cerca de <strong>${Math.round(caloriasAlvo)} kcal/dia</strong></div>
            <div class="mensagem">Nesse ritmo (~${ritmoSemanal.toFixed(2)} kg/semana), você atingiria a meta em cerca de <strong>${semanas} semana(s)</strong> — ${dataEstimada(semanas)}.</div>
        `;
        resumoCompartilhar = `Para ganhar ${kgGanhar.toFixed(1)} kg e chegar ${rotuloAlvo}, preciso comer cerca de ${Math.round(caloriasAlvo)} kcal/dia. Meta prevista para daqui a ${semanas} semana(s).`;
    } else {
        caloriasAlvo = manutencao;
        objetivo = `
            <div class="mensagem">${usandoMeta ? 'Você já está no peso desejado!' : 'Você já está no peso ideal!'}</div>
            <div class="calorias-alvo manter">Para manter o peso, coma cerca de <strong>${Math.round(caloriasAlvo)} kcal/dia</strong></div>
        `;
        resumoCompartilhar = `Já estou no meu peso! Para manter, preciso comer cerca de ${Math.round(caloriasAlvo)} kcal/dia.`;
    }

    // Guarda a meta calórica para o diário alimentar
    gravarStorage(CHAVE_META, JSON.stringify({ calorias: Math.round(caloriasAlvo) }));
    textosCompartilhar.calorias = resumoCompartilhar;

    resultadoDiv.innerHTML = `
        ${avisos}
        <div class="info-linha">Taxa Metabólica Basal (TMB): <strong>${Math.round(tmb)} kcal/dia</strong></div>
        <div class="info-linha">Gasto diário para manter o peso atual: <strong>${Math.round(manutencao)} kcal/dia</strong></div>
        <hr>
        ${objetivo}
        ${montarMacros(caloriasAlvo)}
        ${botaoCompartilhar('calorias')}
        <div class="aviso">* Valores estimados. Consulte um nutricionista para um plano personalizado.</div>
    `;

    renderizarDiario();
}

// ===== ABA 3: DIÁRIO DO DIA (alimentação + exercícios) =====

// Gasto calórico por atividade em METs (Compêndio de Atividades Físicas).
// 1 MET ≈ 1 kcal por kg de peso por hora.
const ATIVIDADES = [
    { nome: 'Caminhada leve', met: 3.0 },
    { nome: 'Caminhada rápida', met: 4.5 },
    { nome: 'Corrida leve (8 km/h)', met: 8.0 },
    { nome: 'Corrida (10 km/h)', met: 10.0 },
    { nome: 'Bicicleta (passeio)', met: 5.5 },
    { nome: 'Bicicleta (ritmo forte)', met: 8.0 },
    { nome: 'Natação', met: 7.0 },
    { nome: 'Hidroginástica', met: 5.5 },
    { nome: 'Musculação', met: 4.0 },
    { nome: 'Futebol', met: 7.0 },
    { nome: 'Dança', met: 5.0 },
    { nome: 'Pular corda', met: 11.0 },
    { nome: 'Yoga / alongamento', met: 2.5 },
    { nome: 'Serviços domésticos', met: 3.5 }
];

// Alimentos comuns do dia a dia em medidas caseiras (valores aproximados
// da tabela TACO, por porção indicada) — para adicionar com um toque
const ALIMENTOS_RAPIDOS = [
    { emoji: '🥖', nome: 'Pão francês', medida: '1 unidade', kcal: 150, prot: 4.0, carb: 29.0, gord: 1.6 },
    { emoji: '🍞', nome: 'Pão de forma', medida: '1 fatia', kcal: 65, prot: 2.3, carb: 12.0, gord: 0.9 },
    { emoji: '🥚', nome: 'Ovo cozido', medida: '1 unidade', kcal: 73, prot: 6.5, carb: 0.3, gord: 4.8 },
    { emoji: '🍳', nome: 'Ovo frito', medida: '1 unidade', kcal: 100, prot: 6.8, carb: 0.3, gord: 8.0 },
    { emoji: '🧀', nome: 'Queijo minas', medida: '1 fatia', kcal: 79, prot: 5.2, carb: 1.0, gord: 6.1 },
    { emoji: '🥛', nome: 'Leite integral', medida: '1 copo', kcal: 120, prot: 6.4, carb: 9.2, gord: 6.4 },
    { emoji: '☕', nome: 'Café com açúcar', medida: '1 xícara', kcal: 25, prot: 0.2, carb: 6.0, gord: 0 },
    { emoji: '🍌', nome: 'Banana', medida: '1 unidade', kcal: 65, prot: 0.9, carb: 16.5, gord: 0.1 },
    { emoji: '🍎', nome: 'Maçã', medida: '1 unidade', kcal: 72, prot: 0.4, carb: 19.7, gord: 0.2 },
    { emoji: '🍊', nome: 'Laranja', medida: '1 unidade', kcal: 63, prot: 1.1, carb: 15.7, gord: 0.1 },
    { emoji: '🍚', nome: 'Arroz branco', medida: '1 colher de servir', kcal: 58, prot: 1.1, carb: 12.6, gord: 0.1 },
    { emoji: '🫘', nome: 'Feijão', medida: '1 concha', kcal: 65, prot: 4.1, carb: 11.6, gord: 0.4 },
    { emoji: '🍗', nome: 'Frango grelhado', medida: '1 filé', kcal: 165, prot: 31.0, carb: 0, gord: 3.6 },
    { emoji: '🥩', nome: 'Carne bovina', medida: '1 bife', kcal: 219, prot: 32.0, carb: 0, gord: 9.0 },
    { emoji: '🐟', nome: 'Peixe grelhado', medida: '1 filé', kcal: 120, prot: 24.0, carb: 0, gord: 2.5 },
    { emoji: '🥔', nome: 'Batata cozida', medida: '1 unidade média', kcal: 73, prot: 1.7, carb: 16.7, gord: 0.1 },
    { emoji: '🍝', nome: 'Macarrão', medida: '1 pegador', kcal: 120, prot: 3.7, carb: 25.0, gord: 0.6 },
    { emoji: '🥗', nome: 'Salada verde', medida: '1 prato', kcal: 15, prot: 1.0, carb: 2.5, gord: 0.2 },
    { emoji: '🧃', nome: 'Suco de laranja', medida: '1 copo', kcal: 110, prot: 1.7, carb: 25.0, gord: 0.2 },
    { emoji: '🥤', nome: 'Refrigerante', medida: '1 copo', kcal: 105, prot: 0, carb: 26.0, gord: 0 },
    { emoji: '🍕', nome: 'Pizza', medida: '1 fatia', kcal: 280, prot: 12.0, carb: 33.0, gord: 11.0 },
    { emoji: '🍫', nome: 'Chocolate', medida: '2 quadradinhos', kcal: 135, prot: 1.9, carb: 15.0, gord: 7.9 }
];

// Água: recomendação de ~35 ml por kg de peso, contada em copos de 250 ml
const COPO_ML = 250;
const AGUA_ML_POR_KG = 35;
const META_AGUA_PADRAO = 2000;

let resultadosBuscaAtual = [];

// Peso atual do usuário (campo sincronizado entre as abas)
function pesoAtualUsuario() {
    const peso = parseFloat(document.getElementById('peso').value);
    if (!isNaN(peso) && peso >= 20 && peso <= 400) return peso;
    return null;
}

function carregarDiario() {
    try {
        const diario = JSON.parse(lerStorage(CHAVE_DIARIO));
        if (diario && diario.data === dataHojeISO() && Array.isArray(diario.itens)) {
            if (!Array.isArray(diario.exercicios)) diario.exercicios = [];
            if (typeof diario.agua !== 'number' || diario.agua < 0) diario.agua = 0;
            // Migra itens do formato antigo (gramas sobre valores por 100 g)
            diario.itens = diario.itens.map(function (item) {
                if (item.gramas !== undefined) {
                    return {
                        nome: item.nome,
                        medida: '100 g',
                        kcal: item.kcal,
                        prot: item.prot,
                        carb: item.carb,
                        gord: item.gord,
                        quantidade: item.gramas / 100
                    };
                }
                return item;
            });
            return diario;
        }
    } catch (e) {
        // diário corrompido ou de outro dia: começa um novo
    }
    return { data: dataHojeISO(), itens: [], exercicios: [], agua: 0 };
}

function salvarDiario(diario) {
    gravarStorage(CHAVE_DIARIO, JSON.stringify(diario));
}

function buscarAlimento() {
    const termo = document.getElementById('buscaAlimento').value.trim();
    const div = document.getElementById('resultadosBusca');

    if (termo.length < 2) {
        div.innerHTML = mensagemErros(['Digite pelo menos 2 letras para buscar.']);
        return;
    }

    div.innerHTML = '<div class="mensagem busca-status">Buscando alimentos…</div>';

    const url = 'https://br.openfoodfacts.org/cgi/search.pl?action=process&json=1&search_simple=1&page_size=8' +
        '&fields=product_name,brands,nutriments&search_terms=' + encodeURIComponent(termo);

    fetch(url)
        .then(function (resposta) { return resposta.json(); })
        .then(function (dados) {
            const produtos = (dados.products || []).filter(function (p) {
                return p.product_name && p.nutriments && p.nutriments['energy-kcal_100g'] !== undefined;
            });

            if (produtos.length === 0) {
                div.innerHTML = '<div class="mensagem busca-status">Nenhum alimento com dados nutricionais encontrado. Tente outro termo (em português ou inglês).</div>';
                return;
            }

            resultadosBuscaAtual = produtos.map(function (p) {
                return {
                    nome: p.product_name + (p.brands ? ' — ' + p.brands.split(',')[0].trim() : ''),
                    kcal: parseFloat(p.nutriments['energy-kcal_100g']) || 0,
                    prot: parseFloat(p.nutriments['proteins_100g']) || 0,
                    carb: parseFloat(p.nutriments['carbohydrates_100g']) || 0,
                    gord: parseFloat(p.nutriments['fat_100g']) || 0
                };
            });

            let html = '<div class="busca-fonte">Fonte: Open Food Facts · valores por 100 g</div>';
            resultadosBuscaAtual.forEach(function (item, indice) {
                html += `
                    <div class="alimento-linha">
                        <div class="alimento-info">
                            <div class="alimento-nome">${escapeHTML(item.nome)}</div>
                            <div class="alimento-macros">${Math.round(item.kcal)} kcal · P ${item.prot.toFixed(1)} g · C ${item.carb.toFixed(1)} g · G ${item.gord.toFixed(1)} g</div>
                        </div>
                        <button type="button" class="btn-add" title="Adicionar ao diário" onclick="adicionarAlimento(${indice})">+</button>
                    </div>`;
            });
            div.innerHTML = html;
        })
        .catch(function () {
            div.innerHTML = mensagemErros(['Não foi possível buscar agora. Verifique sua conexão e tente novamente.']);
        });
}

// Insere um item no diário; se já existe o mesmo alimento, soma a quantidade
function inserirItemDiario(novo) {
    const diario = carregarDiario();
    const existente = diario.itens.find(function (item) {
        return item.nome === novo.nome && item.medida === novo.medida;
    });
    if (existente) {
        existente.quantidade = Math.round((existente.quantidade + novo.quantidade) * 10) / 10;
    } else {
        diario.itens.push(novo);
    }
    salvarDiario(diario);
    renderizarDiario();
}

// Alimento rápido: um toque adiciona 1 porção
function adicionarRapido(indice) {
    const alimento = ALIMENTOS_RAPIDOS[indice];
    if (!alimento) return;
    inserirItemDiario({
        nome: alimento.nome,
        medida: alimento.medida,
        kcal: alimento.kcal,
        prot: alimento.prot,
        carb: alimento.carb,
        gord: alimento.gord,
        quantidade: 1
    });
}

// Alimento vindo da busca: entra como 1 porção de 100 g
function adicionarAlimento(indice) {
    const item = resultadosBuscaAtual[indice];
    if (!item) return;
    inserirItemDiario({
        nome: item.nome,
        medida: '100 g',
        kcal: item.kcal,
        prot: item.prot,
        carb: item.carb,
        gord: item.gord,
        quantidade: 1
    });
}

function ajustarQuantidade(indice, delta) {
    const diario = carregarDiario();
    const item = diario.itens[indice];
    if (!item) return;
    const nova = Math.round((item.quantidade + delta) * 10) / 10;
    if (nova <= 0) {
        diario.itens.splice(indice, 1);
    } else {
        item.quantidade = Math.min(nova, 50);
    }
    salvarDiario(diario);
    renderizarDiario();
}

function removerAlimento(indice) {
    const diario = carregarDiario();
    diario.itens.splice(indice, 1);
    salvarDiario(diario);
    renderizarDiario();
}

function limparDiario() {
    if (!confirm('Limpar todos os alimentos, exercícios e água de hoje?')) return;
    salvarDiario({ data: dataHojeISO(), itens: [], exercicios: [], agua: 0 });
    renderizarDiario();
}

// ===== Água do dia =====
function ajustarAgua(copos) {
    const diario = carregarDiario();
    diario.agua = Math.max(0, diario.agua + copos * COPO_ML);
    salvarDiario(diario);
    renderizarDiario();
}

function formatarLitros(ml) {
    return (ml / 1000).toFixed(1).replace('.', ',') + ' L';
}

function renderizarAgua(diario) {
    const div = document.getElementById('aguaDia');
    const peso = pesoAtualUsuario();
    // Meta arredondada para múltiplos de 50 ml
    const metaAgua = peso ? Math.round((peso * AGUA_ML_POR_KG) / 50) * 50 : META_AGUA_PADRAO;
    const copos = Math.round(diario.agua / COPO_ML);
    const percentual = Math.round((diario.agua / metaAgua) * 100);
    const atingiu = diario.agua >= metaAgua;

    const notaMeta = peso
        ? `Sua meta: ${formatarLitros(metaAgua)} por dia (35 ml por kg)`
        : `Meta padrão: ${formatarLitros(metaAgua)} — informe seu peso na aba IMC para personalizar`;

    div.innerHTML = `
        <div class="progresso-texto"><strong>${formatarLitros(diario.agua)}</strong> de <strong>${formatarLitros(metaAgua)}</strong> (${copos} copo${copos === 1 ? '' : 's'})</div>
        <div class="progresso-track">
            <div class="progresso-fill agua" style="width: ${Math.min(percentual, 100)}%"></div>
        </div>
        <div class="progresso-sub">${atingiu ? 'Meta de água atingida! 💧 Continue se hidratando.' : notaMeta}</div>
        <div class="agua-botoes">
            <button type="button" class="btn-secundario agua-menos" onclick="ajustarAgua(-1)" ${diario.agua === 0 ? 'disabled' : ''}>−</button>
            <button type="button" class="agua-mais" onclick="ajustarAgua(1)">💧 Bebi 1 copo (250 ml)</button>
        </div>
    `;
}

// Grade de atalhos de alimentos comuns (montada uma vez na inicialização)
function renderizarAtalhos() {
    let html = '';
    ALIMENTOS_RAPIDOS.forEach(function (alimento, indice) {
        html += `
            <button type="button" class="chip" onclick="adicionarRapido(${indice})" title="${alimento.medida} · ${alimento.kcal} kcal">
                <span class="chip-emoji">${alimento.emoji}</span>
                <span class="chip-nome">${alimento.nome}</span>
                <span class="chip-kcal">${alimento.kcal} kcal</span>
            </button>`;
    });
    document.getElementById('atalhosAlimentos').innerHTML = html;
}

// ===== Exercícios do dia =====
function preencherAtividades() {
    const select = document.getElementById('exercicioTipo');
    ATIVIDADES.forEach(function (atividade, indice) {
        const opcao = document.createElement('option');
        opcao.value = indice;
        opcao.textContent = atividade.nome;
        select.appendChild(opcao);
    });
}

function adicionarExercicio() {
    const indice = parseInt(document.getElementById('exercicioTipo').value, 10);
    const minutos = parseFloat(document.getElementById('exercicioMinutos').value);
    const atividade = ATIVIDADES[indice];
    const div = document.getElementById('exerciciosDia');

    if (!atividade) return;
    if (isNaN(minutos) || minutos < 1 || minutos > 600) {
        div.innerHTML = mensagemErros(['Informe a duração entre 1 e 600 minutos.']);
        return;
    }
    const peso = pesoAtualUsuario();
    if (!peso) {
        div.innerHTML = mensagemErros(['Preencha seu peso na aba IMC para calcular o gasto calórico.']);
        return;
    }

    const kcal = atividade.met * peso * (minutos / 60);
    const diario = carregarDiario();
    diario.exercicios.push({
        nome: atividade.nome,
        minutos: Math.round(minutos),
        kcal: Math.round(kcal)
    });
    salvarDiario(diario);
    document.getElementById('exercicioMinutos').value = '';
    renderizarDiario();
}

function removerExercicio(indice) {
    const diario = carregarDiario();
    diario.exercicios.splice(indice, 1);
    salvarDiario(diario);
    renderizarDiario();
}

// Equivalência de um excesso calórico em minutos de exercício
function equivalenciaExercicio(kcalExcesso, peso) {
    if (!peso || kcalExcesso <= 0) return '';
    const minCaminhada = Math.round((kcalExcesso * 60) / (4.5 * peso));
    const minCorrida = Math.round((kcalExcesso * 60) / (10.0 * peso));
    return `Para compensar: ~${minCaminhada} min de caminhada rápida ou ~${minCorrida} min de corrida.`;
}

function renderizarDiario() {
    const diario = carregarDiario();
    const metaDiv = document.getElementById('metaDia');
    const listaDiv = document.getElementById('diarioDia');

    let metaCalorias = null;
    try {
        const meta = JSON.parse(lerStorage(CHAVE_META));
        if (meta && meta.calorias > 0) metaCalorias = meta.calorias;
    } catch (e) {
        // sem meta definida ainda
    }

    renderizarAgua(diario);

    // Totais consumidos (valores por porção × quantidade)
    const total = { kcal: 0, prot: 0, carb: 0, gord: 0 };
    diario.itens.forEach(function (item) {
        total.kcal += item.kcal * item.quantidade;
        total.prot += item.prot * item.quantidade;
        total.carb += item.carb * item.quantidade;
        total.gord += item.gord * item.quantidade;
    });

    // Calorias queimadas em exercícios: viram crédito na meta do dia
    const queimado = diario.exercicios.reduce(function (soma, exercicio) {
        return soma + exercicio.kcal;
    }, 0);

    // Painel de meta / progresso do dia
    if (metaCalorias) {
        const metaAjustada = metaCalorias + queimado;
        const percentual = Math.round((total.kcal / metaAjustada) * 100);
        const largura = Math.min(percentual, 100);
        const estourou = total.kcal > metaAjustada;
        const restante = Math.round(metaAjustada - total.kcal);
        const notaExercicio = queimado > 0
            ? `<div class="progresso-sub">Meta ${metaCalorias} kcal + ${queimado} kcal queimadas em exercício</div>`
            : '';
        const equivalencia = estourou
            ? `<div class="progresso-sub">${equivalenciaExercicio(Math.abs(restante), pesoAtualUsuario())}</div>`
            : '';
        metaDiv.innerHTML = `
            <div class="progresso-texto"><strong>${Math.round(total.kcal)}</strong> de <strong>${metaAjustada}</strong> kcal (${percentual}%)</div>
            <div class="progresso-track">
                <div class="progresso-fill ${estourou ? 'estourou' : ''}" style="width: ${largura}%"></div>
            </div>
            ${notaExercicio}
            <div class="progresso-sub">${estourou
                ? 'Você passou ' + Math.abs(restante) + ' kcal da sua meta hoje.'
                : 'Ainda cabem ' + restante + ' kcal hoje.'}</div>
            ${equivalencia}
        `;
    } else {
        metaDiv.innerHTML = '<div class="mensagem busca-status">Calcule suas calorias na aba <strong>Calorias</strong> para definir a meta diária e acompanhar o progresso aqui.</div>';
    }

    // Lista de alimentos do dia
    if (diario.itens.length === 0) {
        listaDiv.innerHTML = '<div class="mensagem busca-status">Nenhum alimento registrado hoje. Toque nos alimentos acima para adicionar.</div>';
    } else {
        let linhas = '';
        diario.itens.forEach(function (item, indice) {
            const qtd = item.quantidade;
            // Ex.: "2 × 1 unidade" ou, para itens da busca, "150 g"
            const rotuloQtd = item.medida === '100 g'
                ? (qtd * 100).toFixed(0) + ' g'
                : String(qtd).replace('.', ',') + ' × ' + item.medida;
            linhas += `
                <div class="diario-linha">
                    <div class="alimento-info">
                        <div class="alimento-nome">${escapeHTML(item.nome)}</div>
                        <div class="alimento-macros">${rotuloQtd} · <strong>${Math.round(item.kcal * qtd)} kcal</strong> · P ${(item.prot * qtd).toFixed(1)} g · C ${(item.carb * qtd).toFixed(1)} g · G ${(item.gord * qtd).toFixed(1)} g</div>
                    </div>
                    <div class="qtd-controle">
                        <button type="button" class="qtd-btn" title="Diminuir" onclick="ajustarQuantidade(${indice}, -0.5)">−</button>
                        <button type="button" class="qtd-btn" title="Aumentar" onclick="ajustarQuantidade(${indice}, 0.5)">+</button>
                    </div>
                    <button type="button" class="hist-remover" title="Remover" onclick="removerAlimento(${indice})">×</button>
                </div>`;
        });

        linhas += `
            <div class="diario-total">
                Total: <strong>${Math.round(total.kcal)} kcal</strong> · P ${total.prot.toFixed(1)} g · C ${total.carb.toFixed(1)} g · G ${total.gord.toFixed(1)} g
            </div>
            <button type="button" class="btn-secundario btn-limpar-dia" onclick="limparDiario()">Limpar o dia</button>
        `;
        listaDiv.innerHTML = linhas;
    }

    // Lista de exercícios do dia
    const exerciciosDiv = document.getElementById('exerciciosDia');
    if (diario.exercicios.length === 0) {
        exerciciosDiv.innerHTML = '<div class="mensagem busca-status">Nenhum exercício registrado hoje. Escolha a atividade e a duração acima.</div>';
        return;
    }

    let linhasExercicio = '';
    diario.exercicios.forEach(function (exercicio, indice) {
        linhasExercicio += `
            <div class="diario-linha">
                <div class="alimento-info">
                    <div class="alimento-nome">${escapeHTML(exercicio.nome)}</div>
                    <div class="alimento-macros">${exercicio.minutos} min · ${exercicio.kcal} kcal queimadas</div>
                </div>
                <button type="button" class="hist-remover" title="Remover" onclick="removerExercicio(${indice})">×</button>
            </div>`;
    });
    linhasExercicio += `
        <div class="diario-total queimadas">
            Total queimado: <strong>${queimado} kcal</strong>
        </div>
    `;
    exerciciosDiv.innerHTML = linhasExercicio;
}

// ===== ABA 4: HISTÓRICO DE PESO =====

function carregarHistorico() {
    try {
        const historico = JSON.parse(lerStorage(CHAVE_HISTORICO));
        return Array.isArray(historico) ? historico : [];
    } catch (e) {
        return [];
    }
}

function salvarHistorico(historico) {
    gravarStorage(CHAVE_HISTORICO, JSON.stringify(historico));
}

function dataHojeISO() {
    const hoje = new Date();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const dia = String(hoje.getDate()).padStart(2, '0');
    return `${hoje.getFullYear()}-${mes}-${dia}`;
}

function formatarDataBR(iso) {
    const partes = iso.split('-');
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function registrarPeso() {
    const peso = parseFloat(document.getElementById('pesoHistorico').value);
    if (isNaN(peso) || peso < 20 || peso > 400) {
        document.getElementById('listaHistorico').innerHTML = mensagemErros(['Peso deve estar entre 20 kg e 400 kg.']);
        return;
    }

    const historico = carregarHistorico();
    const hoje = dataHojeISO();
    const existente = historico.find(function (registro) {
        return registro.data === hoje;
    });

    if (existente) {
        existente.peso = peso;
    } else {
        historico.push({ data: hoje, peso: peso });
    }
    historico.sort(function (a, b) {
        return a.data < b.data ? -1 : 1;
    });

    salvarHistorico(historico);
    renderizarHistorico();
    verificarLembrete();
}

function removerRegistro(dataISO) {
    const historico = carregarHistorico().filter(function (registro) {
        return registro.data !== dataISO;
    });
    salvarHistorico(historico);
    renderizarHistorico();
}

// ===== Exportar / importar histórico em CSV =====
function exportarCSV() {
    const historico = carregarHistorico();
    if (historico.length === 0) {
        alert('Nenhuma pesagem registrada para exportar.');
        return;
    }
    // BOM + ponto e vírgula: abre direto no Excel em português
    let csv = '\uFEFFdata;peso\n';
    historico.forEach(function (registro) {
        csv += formatarDataBR(registro.data) + ';' + String(registro.peso).replace('.', ',') + '\n';
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'historico-peso.csv';
    link.click();
    URL.revokeObjectURL(link.href);
}

function importarCSV(input) {
    const arquivo = input.files[0];
    if (!arquivo) return;

    const leitor = new FileReader();
    leitor.onload = function () {
        const linhas = String(leitor.result).replace(/^\uFEFF/, '').split(/\r?\n/);
        const historico = carregarHistorico();
        let importados = 0;

        linhas.forEach(function (linha) {
            const partes = linha.split(/[;,\t]/);
            if (partes.length < 2) return;

            let data = partes[0].trim();
            const brasileira = data.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
            if (brasileira) {
                data = brasileira[3] + '-' + brasileira[2] + '-' + brasileira[1];
            }
            if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return;

            const peso = parseFloat(partes[1].trim().replace(',', '.'));
            if (isNaN(peso) || peso < 20 || peso > 400) return;

            const existente = historico.find(function (registro) {
                return registro.data === data;
            });
            if (existente) {
                existente.peso = peso;
            } else {
                historico.push({ data: data, peso: peso });
            }
            importados++;
        });

        historico.sort(function (a, b) {
            return a.data < b.data ? -1 : 1;
        });
        salvarHistorico(historico);
        renderizarHistorico();
        alert(importados + ' registro(s) importado(s).');
    };
    leitor.readAsText(arquivo);
    input.value = '';
}

// ===== Lembrete diário de pesagem =====
function iniciarLembrete() {
    const caixa = document.getElementById('lembreteAtivo');
    caixa.checked = lerStorage(CHAVE_LEMBRETE) === '1';

    caixa.addEventListener('change', function () {
        gravarStorage(CHAVE_LEMBRETE, caixa.checked ? '1' : '0');
        if (caixa.checked && 'Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().then(verificarLembrete);
        }
        verificarLembrete();
    });

    verificarLembrete();
}

function verificarLembrete() {
    const banner = document.getElementById('lembreteBanner');
    banner.innerHTML = '';

    if (lerStorage(CHAVE_LEMBRETE) !== '1') return;

    const hoje = dataHojeISO();
    const jaRegistrou = carregarHistorico().some(function (registro) {
        return registro.data === hoje;
    });
    if (jaRegistrou) return;

    banner.innerHTML = '<div class="classificacao atencao">Você ainda não registrou seu peso hoje.</div>';

    // Uma notificação do navegador por dia, quando permitido
    if ('Notification' in window && Notification.permission === 'granted' && lerStorage(CHAVE_ULTIMA_NOTIFICACAO) !== hoje) {
        gravarStorage(CHAVE_ULTIMA_NOTIFICACAO, hoje);
        try {
            new Notification('IMC Pro', { body: 'Você ainda não registrou seu peso hoje. Que tal se pesar agora?', icon: 'icons/icon-192.png' });
        } catch (e) {
            // alguns navegadores móveis só permitem notificação via service worker
        }
    }
}

// Gráfico de linha em SVG puro: peso (kg) ao longo das datas registradas
function montarGrafico(historico) {
    if (historico.length < 2) {
        return '<div class="mensagem grafico-vazio">Registre pelo menos duas pesagens para ver o gráfico de evolução.</div>';
    }

    const LARGURA = 340;
    const ALTURA = 190;
    const MARGEM = { topo: 16, direita: 14, baixo: 28, esquerda: 40 };
    const larguraUtil = LARGURA - MARGEM.esquerda - MARGEM.direita;
    const alturaUtil = ALTURA - MARGEM.topo - MARGEM.baixo;

    const pesos = historico.map(function (r) { return r.peso; });
    let minPeso = Math.min.apply(null, pesos);
    let maxPeso = Math.max.apply(null, pesos);
    // Folga vertical para a linha não colar nas bordas
    const folga = Math.max((maxPeso - minPeso) * 0.15, 1);
    minPeso = Math.floor(minPeso - folga);
    maxPeso = Math.ceil(maxPeso + folga);

    function x(indice) {
        return MARGEM.esquerda + (indice / (historico.length - 1)) * larguraUtil;
    }
    function y(peso) {
        return MARGEM.topo + (1 - (peso - minPeso) / (maxPeso - minPeso)) * alturaUtil;
    }

    // Linhas de grade horizontais (4 divisões)
    let grade = '';
    for (let i = 0; i <= 4; i++) {
        const valor = minPeso + ((maxPeso - minPeso) * i) / 4;
        const yPos = y(valor);
        grade += `<line x1="${MARGEM.esquerda}" y1="${yPos.toFixed(1)}" x2="${LARGURA - MARGEM.direita}" y2="${yPos.toFixed(1)}" class="grafico-grade"/>`;
        grade += `<text x="${MARGEM.esquerda - 6}" y="${(yPos + 3.5).toFixed(1)}" class="grafico-eixo" text-anchor="end">${valor.toFixed(1)}</text>`;
    }

    // Linha da série
    const pontos = historico.map(function (r, i) {
        return `${x(i).toFixed(1)},${y(r.peso).toFixed(1)}`;
    }).join(' ');

    // Marcadores com tooltip nativo e alvo de clique generoso
    let marcadores = '';
    historico.forEach(function (r, i) {
        marcadores += `
            <g>
                <circle cx="${x(i).toFixed(1)}" cy="${y(r.peso).toFixed(1)}" r="3.5" class="grafico-ponto"/>
                <circle cx="${x(i).toFixed(1)}" cy="${y(r.peso).toFixed(1)}" r="10" fill="transparent">
                    <title>${formatarDataBR(r.data)}: ${r.peso.toFixed(1)} kg</title>
                </circle>
            </g>`;
    });

    // Rótulo direto no último ponto
    const ultimo = historico[historico.length - 1];
    const rotuloX = Math.min(x(historico.length - 1), LARGURA - MARGEM.direita - 4);
    const rotulo = `<text x="${rotuloX.toFixed(1)}" y="${(y(ultimo.peso) - 8).toFixed(1)}" class="grafico-rotulo" text-anchor="end">${ultimo.peso.toFixed(1)} kg</text>`;

    // Datas nas extremidades do eixo X
    const eixoX = `
        <text x="${MARGEM.esquerda}" y="${ALTURA - 8}" class="grafico-eixo" text-anchor="start">${formatarDataBR(historico[0].data)}</text>
        <text x="${LARGURA - MARGEM.direita}" y="${ALTURA - 8}" class="grafico-eixo" text-anchor="end">${formatarDataBR(ultimo.data)}</text>
    `;

    return `
        <div class="grafico-titulo">Evolução do peso (kg)</div>
        <svg viewBox="0 0 ${LARGURA} ${ALTURA}" class="grafico-svg" role="img" aria-label="Gráfico de evolução do peso">
            ${grade}
            <polyline points="${pontos}" class="grafico-linha"/>
            ${marcadores}
            ${rotulo}
            ${eixoX}
        </svg>
    `;
}

function renderizarHistorico() {
    const historico = carregarHistorico();
    const graficoDiv = document.getElementById('grafico');
    const listaDiv = document.getElementById('listaHistorico');

    if (historico.length === 0) {
        graficoDiv.innerHTML = '';
        listaDiv.innerHTML = '<div class="mensagem grafico-vazio">Nenhuma pesagem registrada ainda. Registre seu peso de hoje para começar a acompanhar.</div>';
        return;
    }

    graficoDiv.innerHTML = montarGrafico(historico);

    // Lista da mais recente para a mais antiga, com variação em relação à anterior
    let linhas = '';
    for (let i = historico.length - 1; i >= 0; i--) {
        const registro = historico[i];
        let variacao = '<span class="hist-delta neutro">—</span>';
        if (i > 0) {
            const delta = registro.peso - historico[i - 1].peso;
            if (delta > 0.05) {
                variacao = `<span class="hist-delta subiu">▲ +${delta.toFixed(1)} kg</span>`;
            } else if (delta < -0.05) {
                variacao = `<span class="hist-delta desceu">▼ ${delta.toFixed(1)} kg</span>`;
            } else {
                variacao = '<span class="hist-delta neutro">= 0,0 kg</span>';
            }
        }
        linhas += `
            <div class="hist-linha">
                <span class="hist-data">${formatarDataBR(registro.data)}</span>
                <span class="hist-peso">${registro.peso.toFixed(1)} kg</span>
                ${variacao}
                <button type="button" class="hist-remover" title="Remover este registro" onclick="removerRegistro('${registro.data}')">×</button>
            </div>`;
    }
    listaDiv.innerHTML = linhas;
}

// ===== Inicialização (script carrega com defer, DOM já pronto) =====
restaurarDados();
iniciarSincronizacao();
preencherAtividades();
renderizarAtalhos();
renderizarHistorico();
renderizarDiario();
iniciarLembrete();
