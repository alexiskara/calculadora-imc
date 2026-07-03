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

// ===== Dados compartilhados entre abas + salvamento no navegador =====
const CHAVE_STORAGE = 'imcProDados';
const CHAVE_HISTORICO = 'imcProHistorico';

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
            });
        });
    });
    ['idade', 'sexo', 'atividade', 'metaPeso', 'ritmo'].forEach(function (id) {
        document.getElementById(id).addEventListener('input', salvarDados);
    });
}

function limparDados() {
    if (!confirm('Isso vai apagar todos os dados salvos, inclusive o histórico de peso. Deseja continuar?')) {
        return;
    }
    try {
        localStorage.removeItem(CHAVE_STORAGE);
        localStorage.removeItem(CHAVE_HISTORICO);
    } catch (e) {
        // sem localStorage, nada a limpar
    }
    document.querySelectorAll('input').forEach(function (campo) {
        campo.value = '';
    });
    document.getElementById('sexo').selectedIndex = 0;
    document.getElementById('atividade').selectedIndex = 0;
    document.getElementById('ritmo').selectedIndex = 1;
    document.getElementById('resultado').innerHTML = '';
    document.getElementById('resultadoCalorias').innerHTML = '';
    renderizarHistorico();
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

    resultadoDiv.innerHTML = `
        <div class="imc-valor">Seu IMC: <strong>${imc.toFixed(2)}</strong></div>
        <div class="classificacao ${classificacao.classe}">${classificacao.texto}</div>
        ${montarBarraIMC(imc)}
        <div class="peso-ideal">
            Peso ideal para sua altura: <strong>${faixa.minimo.toFixed(1)} kg a ${faixa.maximo.toFixed(1)} kg</strong>
        </div>
        <div class="mensagem">${mensagemPeso}</div>
        <div class="aviso">* O IMC é uma referência para adultos e não substitui avaliação médica.</div>
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
    } else {
        caloriasAlvo = manutencao;
        objetivo = `
            <div class="mensagem">${usandoMeta ? 'Você já está no peso desejado!' : 'Você já está no peso ideal!'}</div>
            <div class="calorias-alvo manter">Para manter o peso, coma cerca de <strong>${Math.round(caloriasAlvo)} kcal/dia</strong></div>
        `;
    }

    resultadoDiv.innerHTML = `
        ${avisos}
        <div class="info-linha">Taxa Metabólica Basal (TMB): <strong>${Math.round(tmb)} kcal/dia</strong></div>
        <div class="info-linha">Gasto diário para manter o peso atual: <strong>${Math.round(manutencao)} kcal/dia</strong></div>
        <hr>
        ${objetivo}
        ${montarMacros(caloriasAlvo)}
        <div class="aviso">* Valores estimados. Consulte um nutricionista para um plano personalizado.</div>
    `;
}

// ===== ABA 3: HISTÓRICO DE PESO =====

function carregarHistorico() {
    try {
        const historico = JSON.parse(localStorage.getItem(CHAVE_HISTORICO));
        return Array.isArray(historico) ? historico : [];
    } catch (e) {
        return [];
    }
}

function salvarHistorico(historico) {
    try {
        localStorage.setItem(CHAVE_HISTORICO, JSON.stringify(historico));
    } catch (e) {
        // sem localStorage, o histórico vive só nesta sessão
    }
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
}

function removerRegistro(dataISO) {
    const historico = carregarHistorico().filter(function (registro) {
        return registro.data !== dataISO;
    });
    salvarHistorico(historico);
    renderizarHistorico();
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
renderizarHistorico();
