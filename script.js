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

// ===== ABA 3: DIÁRIO ALIMENTAR (busca via Open Food Facts) =====
let resultadosBuscaAtual = [];

function carregarDiario() {
    try {
        const diario = JSON.parse(lerStorage(CHAVE_DIARIO));
        if (diario && diario.data === dataHojeISO() && Array.isArray(diario.itens)) {
            return diario;
        }
    } catch (e) {
        // diário corrompido ou de outro dia: começa um novo
    }
    return { data: dataHojeISO(), itens: [] };
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

function adicionarAlimento(indice) {
    const item = resultadosBuscaAtual[indice];
    if (!item) return;
    const diario = carregarDiario();
    diario.itens.push({
        nome: item.nome,
        gramas: 100,
        kcal: item.kcal,
        prot: item.prot,
        carb: item.carb,
        gord: item.gord
    });
    salvarDiario(diario);
    renderizarDiario();
}

function atualizarGramas(indice, valor) {
    const gramas = parseFloat(valor);
    const diario = carregarDiario();
    if (!diario.itens[indice]) return;
    diario.itens[indice].gramas = isNaN(gramas) || gramas < 1 ? 1 : Math.min(gramas, 3000);
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
    if (!confirm('Limpar todos os alimentos de hoje?')) return;
    salvarDiario({ data: dataHojeISO(), itens: [] });
    renderizarDiario();
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

    // Totais consumidos
    const total = { kcal: 0, prot: 0, carb: 0, gord: 0 };
    diario.itens.forEach(function (item) {
        const fator = item.gramas / 100;
        total.kcal += item.kcal * fator;
        total.prot += item.prot * fator;
        total.carb += item.carb * fator;
        total.gord += item.gord * fator;
    });

    // Painel de meta / progresso do dia
    if (metaCalorias) {
        const percentual = Math.round((total.kcal / metaCalorias) * 100);
        const largura = Math.min(percentual, 100);
        const estourou = total.kcal > metaCalorias;
        const restante = Math.round(metaCalorias - total.kcal);
        metaDiv.innerHTML = `
            <div class="progresso-texto"><strong>${Math.round(total.kcal)}</strong> de <strong>${metaCalorias}</strong> kcal (${percentual}%)</div>
            <div class="progresso-track">
                <div class="progresso-fill ${estourou ? 'estourou' : ''}" style="width: ${largura}%"></div>
            </div>
            <div class="progresso-sub">${estourou
                ? 'Você passou ' + Math.abs(restante) + ' kcal da sua meta hoje.'
                : 'Ainda cabem ' + restante + ' kcal hoje.'}</div>
        `;
    } else {
        metaDiv.innerHTML = '<div class="mensagem busca-status">Calcule suas calorias na aba <strong>Calorias</strong> para definir a meta diária e acompanhar o progresso aqui.</div>';
    }

    // Lista de alimentos do dia
    if (diario.itens.length === 0) {
        listaDiv.innerHTML = '<div class="mensagem busca-status">Nenhum alimento registrado hoje. Busque acima e adicione com o botão +.</div>';
        return;
    }

    let linhas = '';
    diario.itens.forEach(function (item, indice) {
        const fator = item.gramas / 100;
        linhas += `
            <div class="diario-linha">
                <div class="alimento-info">
                    <div class="alimento-nome">${escapeHTML(item.nome)}</div>
                    <div class="alimento-macros">${Math.round(item.kcal * fator)} kcal · P ${(item.prot * fator).toFixed(1)} g · C ${(item.carb * fator).toFixed(1)} g · G ${(item.gord * fator).toFixed(1)} g</div>
                </div>
                <div class="diario-gramas">
                    <input type="number" value="${item.gramas}" min="1" max="3000" onchange="atualizarGramas(${indice}, this.value)"> g
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
renderizarHistorico();
renderizarDiario();
iniciarLembrete();
