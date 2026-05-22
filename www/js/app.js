const EMPRESA = {
  nome: "VIDROART",
  endereco: "Avenida Frei Florentino, 214, Centro, Muzambinho",
  cnpj: "19.397.220.0001/29",
  telefone: "(35) 3571-5750",
  whatsapp: "(35) 99162-4506",
  logoUrl: "https://i.imgur.com/HziCJbE.png"
};

const PDF_CORES = {
  verde: [30, 132, 73],
  texto: [51, 51, 51],
  cinzaClaro: [240, 240, 240],
  borda: [204, 204, 204],
  branco: [255, 255, 255]
};

let produtosAdicionados = [];
let produtoEmEdicaoIndex = -1;
let logoPdfPromise = null;

// ── Capacitor plugins ──────────────────────────────────────────────────────────
function getFilesystem() {
  return window.Capacitor?.Plugins?.Filesystem || null;
}
function getCamera() {
  return window.Capacitor?.Plugins?.Camera || null;
}

// ── Helpers gerais ─────────────────────────────────────────────────────────────
function getElement(id) { return document.getElementById(id); }

function getValue(id, defaultValue = "") {
  const el = getElement(id);
  if (!el) return defaultValue;
  if (typeof el.value !== "string") return defaultValue;
  return el.value.trim();
}

function setValue(id, value) {
  const el = getElement(id);
  if (el) el.value = value;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

function normalizarTextoPdf(texto) {
  return String(texto ?? "").normalize("NFC").replace(/\r?\n/g," ").replace(/\s+/g," ").replace(/[^\u0000-\u00FF]/g,"").trim();
}

function parseNumero(valor) {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;
  const texto = String(valor ?? "").replace(/\s/g,"").replace("R$","").replace(/\.(?=\d{3}(?:\D|$))/g,"").replace(",",".");
  const n = parseFloat(texto);
  return Number.isFinite(n) ? n : 0;
}

function formatarMoeda(valor) {
  return parseNumero(valor).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatarData(data = new Date()) {
  return new Intl.DateTimeFormat("pt-BR").format(data);
}

function normalizarHexCor(cor) {
  return /^#[0-9a-f]{6}$/i.test(String(cor || "")) ? cor : "#ffffff";
}

function hexParaRgb(hex) {
  const cor = normalizarHexCor(hex).replace("#","");
  return [parseInt(cor.slice(0,2),16), parseInt(cor.slice(2,4),16), parseInt(cor.slice(4,6),16)];
}

function getImageFormat(dataUrl) {
  if (typeof dataUrl !== "string") return "JPEG";
  if (dataUrl.startsWith("data:image/png")) return "PNG";
  return "JPEG";
}

function calcularAreaProduto(largura, altura, quantidade) {
  const lm = parseNumero(largura)/1000, am = parseNumero(altura)/1000, qtd = parseNumero(quantidade);
  const area = lm * am * qtd;
  return area > 0 ? area.toFixed(2) : "";
}

function gerarNumeroOrcamento() {
  const agora = new Date();
  const data = `${agora.getFullYear()}${String(agora.getMonth()+1).padStart(2,"0")}${String(agora.getDate()).padStart(2,"0")}`;
  return `ORC-${data}-${Math.floor(Math.random()*9000)+1000}`;
}

function criarNomeArquivo(cliente, numeroOrcamento) {
  const c = String(cliente||"cliente").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^\w\s-]/g,"").trim().replace(/\s+/g,"-").toLowerCase();
  return `orcamento-${c||"cliente"}-${numeroOrcamento.toLowerCase()}.pdf`;
}

function mostrarAviso(texto, tipo = "success") {
  const aviso = document.createElement("div");
  aviso.textContent = texto;
  aviso.className = `fixed top-4 left-1/2 -translate-x-1/2 ${tipo==="error"?"bg-red-600":"bg-green-600"} text-white px-6 py-3 rounded-full shadow-lg z-50`;
  document.body.appendChild(aviso);
  setTimeout(() => aviso.remove(), 2800);
}

function alternarModoEdicao(ativo) {
  getElement("adicionarProdutoBtn")?.classList.toggle("hidden", ativo);
  getElement("salvarEdicaoBtn")?.classList.toggle("hidden", !ativo);
}

// ── Histórico ──────────────────────────────────────────────────────────────────
function obterHistorico() {
  try {
    const h = JSON.parse(localStorage.getItem("historicoPDFs"));
    return Array.isArray(h) ? h : [];
  } catch { return []; }
}

function salvarHistorico(historico) {
  localStorage.setItem("historicoPDFs", JSON.stringify(historico));
}

// ── Imagens ────────────────────────────────────────────────────────────────────
function lerArquivoComoDataURL(fileOrBlob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result || "");
    reader.onerror = reject;
    reader.readAsDataURL(fileOrBlob);
  });
}

function carregarImagem(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

async function normalizarImagemParaDataUrl(dataUrl, options = {}) {
  const { maxWidth=1400, maxHeight=1400, mimeType="image/jpeg", quality=0.82, fundo="#ffffff" } = options;
  if (!dataUrl) return "";
  try {
    const img = await carregarImagem(dataUrl);
    const scale = Math.min(maxWidth/img.width, maxHeight/img.height, 1);
    const w = Math.max(1, Math.round(img.width*scale));
    const h = Math.max(1, Math.round(img.height*scale));
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    if (mimeType === "image/jpeg") { ctx.fillStyle = fundo; ctx.fillRect(0,0,w,h); }
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL(mimeType, quality);
  } catch { return dataUrl; }
}

async function obterImagemProdutoNormalizada(file) {
  const dataUrl = await lerArquivoComoDataURL(file);
  return normalizarImagemParaDataUrl(dataUrl, { maxWidth:1280, maxHeight:1280, mimeType:"image/jpeg", quality:0.8 });
}

async function obterLogoPdf() {
  if (!logoPdfPromise) {
    logoPdfPromise = (async () => {
      try {
        const res = await fetch(EMPRESA.logoUrl, { cache:"force-cache" });
        const blob = await res.blob();
        const raw = await lerArquivoComoDataURL(blob);
        return normalizarImagemParaDataUrl(raw, { maxWidth:420, maxHeight:420, mimeType:"image/png", quality:1 });
      } catch { return ""; }
    })();
  }
  return logoPdfPromise;
}

// ── Câmera ─────────────────────────────────────────────────────────────────────
async function tirarFotoComCamera() {
  const Camera = getCamera();
  if (!Camera) {
    mostrarAviso("Camera nao disponivel neste dispositivo.", "error");
    return;
  }
  try {
    const foto = await Camera.getPhoto({
      quality: 80,
      allowEditing: false,
      resultType: "dataUrl",
      source: "CAMERA"
    });
    if (foto?.dataUrl) {
      const normalizada = await normalizarImagemParaDataUrl(foto.dataUrl, {
        maxWidth: 1280, maxHeight: 1280, mimeType: "image/jpeg", quality: 0.8
      });
      // Armazena temporariamente para uso no produto
      window._fotoCamera = normalizada;
      // Mostra preview
      const preview = getElement("previewFotoCamera");
      if (preview) {
        preview.src = normalizada;
        preview.classList.remove("hidden");
      }
      getElement("btnTirarFoto")?.querySelector("span") && (getElement("btnTirarFoto").querySelector("span").textContent = "Foto tirada ✓");
      mostrarAviso("Foto capturada com sucesso!");
    }
  } catch (err) {
    if (!String(err).includes("cancelled")) {
      mostrarAviso("Erro ao acessar a camera.", "error");
    }
  }
}

// ── Produto ────────────────────────────────────────────────────────────────────
async function montarProdutoAPartirDoFormulario(fotoExistente = "") {
  const nomeProduto = getValue("produtoNome");
  const largura = getValue("produtoLargura");
  const altura = getValue("produtoAltura");
  const qtd = getValue("produtoQtd","1");
  const vidro = getValue("produtoVidro");
  const areaInformada = getValue("produtoArea");
  const unitario = getValue("produtoUnitario");
  const corHex = normalizarHexCor(getElement("produtoCor")?.value || "#ffffff");
  const corNome = getValue("produtoCorNome");
  const fotoFile = getElement("produtoFoto")?.files?.[0];

  if (!nomeProduto || !largura || !altura || !qtd || !vidro || !unitario) {
    alert("Preencha todos os campos obrigatorios do produto antes de continuar.");
    return null;
  }

  const quantidade = parseNumero(qtd);
  const valorUnitario = parseNumero(unitario);

  if (quantidade <= 0 || valorUnitario <= 0) {
    alert("Quantidade e valor unitario precisam ser maiores que zero.");
    return null;
  }

  let foto = fotoExistente;
  if (fotoFile) {
    foto = await obterImagemProdutoNormalizada(fotoFile);
  } else if (window._fotoCamera) {
    foto = window._fotoCamera;
  }

  return {
    nome: nomeProduto, largura, altura,
    quantidade: String(quantidade), vidro,
    area: areaInformada || calcularAreaProduto(largura, altura, quantidade),
    valorUnitario: valorUnitario.toFixed(2),
    valorTotal: Number((valorUnitario * quantidade).toFixed(2)),
    foto, corHex, corNome
  };
}

async function adicionarProduto() {
  const produto = await montarProdutoAPartirDoFormulario();
  if (!produto) return;
  produtosAdicionados.push(produto);
  renderizarProdutosAdicionados();
  limparCamposProduto();
}

function renderizarProdutosAdicionados() {
  const div = getElement("listaProdutos");
  if (!div) return;
  div.innerHTML = "";
  if (produtosAdicionados.length === 0) {
    div.innerHTML = '<p class="empty-message" id="noProductsMessage">Nenhum produto adicionado ainda.</p>';
    return;
  }
  produtosAdicionados.forEach((produto, index) => {
    const item = document.createElement("div");
    item.className = "product-item";
    item.innerHTML = `
      ${produto.foto ? `<img src="${produto.foto}" alt="${escapeHtml(produto.nome)}" style="width:84px;height:84px;object-fit:cover;border-radius:18px;">` : ""}
      <div>
        <p class="font-semibold">${escapeHtml(produto.nome)} (${escapeHtml(produto.largura)}x${escapeHtml(produto.altura)}mm)</p>
        <p class="text-sm">
          Qtd: ${escapeHtml(produto.quantidade)} | Vidro: ${escapeHtml(produto.vidro)}
          ${produto.corNome ? ` | Cor: <span class="color-box" style="background-color:${normalizarHexCor(produto.corHex)};"></span>${escapeHtml(produto.corNome)}` : ""}
          ${produto.area ? ` | Area: ${escapeHtml(produto.area)}m2` : ""}
        </p>
        <p class="text-md font-bold">
          Unitario: R$ ${formatarMoeda(produto.valorUnitario)} | Total: R$ ${formatarMoeda(produto.valorTotal)}
        </p>
      </div>
      <div class="action-buttons">
        <button type="button" class="edit-btn" onclick="editarProduto(${index})" title="Editar"><i class="fas fa-edit"></i></button>
        <button type="button" class="delete-btn" onclick="removerProduto(${index})" title="Remover"><i class="fas fa-trash-alt"></i></button>
      </div>`;
    div.appendChild(item);
  });
}

function limparCamposProduto() {
  setValue("produtoNome",""); setValue("produtoLargura",""); setValue("produtoAltura","");
  setValue("produtoQtd","1"); setValue("produtoVidro",""); setValue("produtoArea","");
  setValue("produtoUnitario",""); setValue("produtoCorNome","");
  if (getElement("produtoFoto")) getElement("produtoFoto").value = "";
  if (getElement("produtoCor")) getElement("produtoCor").value = "#ffffff";
  // Limpa câmera
  window._fotoCamera = null;
  const preview = getElement("previewFotoCamera");
  if (preview) { preview.src=""; preview.classList.add("hidden"); }
  const btnFoto = getElement("btnTirarFoto");
  if (btnFoto?.querySelector("span")) btnFoto.querySelector("span").textContent = "Tirar Foto";
  produtoEmEdicaoIndex = -1;
  alternarModoEdicao(false);
}

function editarProduto(index) {
  const produto = produtosAdicionados[index];
  if (!produto) return;
  setValue("produtoNome", produto.nome||""); setValue("produtoLargura", produto.largura||"");
  setValue("produtoAltura", produto.altura||""); setValue("produtoQtd", produto.quantidade||"1");
  setValue("produtoVidro", produto.vidro||""); setValue("produtoArea", produto.area||"");
  setValue("produtoUnitario", produto.valorUnitario||""); setValue("produtoCorNome", produto.corNome||"");
  if (getElement("produtoCor")) getElement("produtoCor").value = normalizarHexCor(produto.corHex);
  if (getElement("produtoFoto")) getElement("produtoFoto").value = "";
  // Se tinha foto, mostra preview
  if (produto.foto) {
    window._fotoCamera = produto.foto;
    const preview = getElement("previewFotoCamera");
    if (preview) { preview.src = produto.foto; preview.classList.remove("hidden"); }
  }
  produtoEmEdicaoIndex = index;
  alternarModoEdicao(true);
  getElement("orcamento")?.scrollIntoView({ behavior:"smooth" });
}

async function salvarEdicaoProduto() {
  if (produtoEmEdicaoIndex === -1 || !produtosAdicionados[produtoEmEdicaoIndex]) {
    alert("Nenhum produto selecionado para edicao."); return;
  }
  const produtoAtualizado = await montarProdutoAPartirDoFormulario(produtosAdicionados[produtoEmEdicaoIndex]?.foto||"");
  if (!produtoAtualizado) return;
  produtosAdicionados[produtoEmEdicaoIndex] = produtoAtualizado;
  renderizarProdutosAdicionados();
  limparCamposProduto();
}

function removerProduto(index) {
  if (!produtosAdicionados[index]) return;
  if (!confirm("Tem certeza que deseja remover este produto?")) return;
  produtosAdicionados.splice(index, 1);
  if (produtoEmEdicaoIndex === index) limparCamposProduto();
  else if (produtoEmEdicaoIndex > index) produtoEmEdicaoIndex -= 1;
  renderizarProdutosAdicionados();
  alternarModoEdicao(produtoEmEdicaoIndex !== -1);
}

// ── Histórico registro ─────────────────────────────────────────────────────────
function registrarOrcamentoNoHistorico(registro) {
  const historico = obterHistorico();
  const novo = { ...registro, produtos: registro.produtos.map(p=>({...p})) };
  try {
    salvarHistorico([...historico, novo]);
    return { salvouFotos: true };
  } catch (error) {
    const quota = error?.name==="QuotaExceededError" || /quota/i.test(String(error?.message||""));
    if (!quota) throw error;
    const semFotos = { ...novo, produtos: novo.produtos.map(p=>({...p, foto:""})) };
    salvarHistorico([...historico, semFotos]);
    return { salvouFotos: false };
  }
}

// ── PDF ────────────────────────────────────────────────────────────────────────
function desenharLinhaCabecalho(doc, x, y, label, value) {
  doc.setFont(undefined,"bold"); doc.text(`${normalizarTextoPdf(label)}:`, x, y);
  doc.setFont(undefined,"normal"); doc.text(normalizarTextoPdf(value||"-"), x+20, y);
}

function desenharTituloPagina(doc, titulo, y, pageWidth) {
  const texto = normalizarTextoPdf(titulo);
  doc.setFontSize(18); doc.setTextColor(...PDF_CORES.verde); doc.setFont(undefined,"bold");
  const largura = doc.getTextWidth(texto)+10;
  const x = (pageWidth-largura)/2;
  doc.setFillColor(...PDF_CORES.cinzaClaro); doc.roundedRect(x,y,largura,9,2,2,"F");
  doc.setDrawColor(...PDF_CORES.verde); doc.roundedRect(x,y,largura,9,2,2,"S");
  doc.text(texto, pageWidth/2, y+6, { align:"center" });
}

function desenharCabecalhoPdf(doc, logoDataUrl) {
  const pw = doc.internal.pageSize.getWidth();
  doc.setFillColor(...PDF_CORES.verde); doc.rect(0,0,pw,22,"F");
  if (logoDataUrl) {
    try { doc.addImage(logoDataUrl, getImageFormat(logoDataUrl), 9,3,16,16); } catch {}
  } else {
    doc.setFontSize(14); doc.setTextColor(...PDF_CORES.branco); doc.setFont(undefined,"bold");
    doc.text(EMPRESA.nome, 9, 13);
  }
  doc.setFontSize(7.5); doc.setTextColor(...PDF_CORES.branco); doc.setFont(undefined,"normal");
  doc.text(normalizarTextoPdf(EMPRESA.endereco), pw-9, 5, {align:"right"});
  doc.text(`CNPJ: ${EMPRESA.cnpj}`, pw-9, 9, {align:"right"});
  doc.text(`Telefone: ${EMPRESA.telefone}`, pw-9, 13, {align:"right"});
  doc.text(`WhatsApp: ${EMPRESA.whatsapp}`, pw-9, 17, {align:"right"});
}

async function gerarPDF() {
  if (produtosAdicionados.length === 0) { alert("Adicione pelo menos um produto antes de gerar o PDF."); return; }
  if (!window.jspdf?.jsPDF) { alert("A biblioteca jsPDF nao foi carregada."); return; }

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation:"p", unit:"mm", format:"a4", compress:true });
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const mx = 10, sw = pw-mx*2, rodape = 30;
    const logoPdf = await obterLogoPdf();

    const clienteNome = getValue("clienteNome");
    const clienteTelefone = getValue("clienteTelefone");
    const clienteEmail = getValue("clienteEmail");
    const clienteEndereco = getValue("clienteEndereco");
    const dataAtual = new Date();
    const dataOrcamento = formatarData(dataAtual);
    const numeroOrcamento = gerarNumeroOrcamento();
    const percentualDesconto = parseNumero(getElement("percentualDesconto")?.value);

    let y = 0, primeiraPagina = false;

    const abrirNovaPagina = (titulo="ORCAMENTO") => {
      if (primeiraPagina) doc.addPage();
      desenharCabecalhoPdf(doc, logoPdf);
      y = 28; desenharTituloPagina(doc, titulo, y, pw); y += 15;
      primeiraPagina = true;
    };

    const garantirEspaco = (h, titulo="ORCAMENTO (CONT.)") => {
      if (y+h <= ph-rodape) return;
      abrirNovaPagina(titulo);
    };

    abrirNovaPagina();

    doc.setFillColor(...PDF_CORES.cinzaClaro); doc.setDrawColor(...PDF_CORES.borda);
    doc.roundedRect(mx,y,sw,34,2,2,"FD");
    doc.setFontSize(9); doc.setTextColor(...PDF_CORES.verde); doc.setFont(undefined,"bold");
    doc.text("DADOS DO CLIENTE", mx+4, y+5);
    doc.setFontSize(8); doc.setTextColor(...PDF_CORES.texto);
    desenharLinhaCabecalho(doc, mx+4, y+10, "Nome", clienteNome||"Cliente nao informado");
    desenharLinhaCabecalho(doc, mx+4, y+14.5, "Telefone", clienteTelefone||"-");
    desenharLinhaCabecalho(doc, mx+4, y+19, "E-mail", clienteEmail||"-");
    const endQ = doc.splitTextToSize(normalizarTextoPdf(clienteEndereco||"-"), sw-34);
    doc.setFont(undefined,"bold"); doc.text("Endereco:", mx+4, y+23.5);
    doc.setFont(undefined,"normal"); doc.text(endQ, mx+24, y+23.5);
    doc.setFont(undefined,"bold"); doc.text("Data:", mx+4, y+30);
    doc.setFont(undefined,"normal"); doc.text(dataOrcamento, mx+24, y+30);
    doc.setFont(undefined,"bold"); doc.text("No:", pw-72, y+30);
    doc.setFont(undefined,"normal"); doc.text(numeroOrcamento, pw-60, y+30);
    y += 42;

    doc.setFillColor(...PDF_CORES.verde); doc.rect(mx,y,sw,6,"F");
    doc.setTextColor(...PDF_CORES.branco); doc.setFont(undefined,"bold"); doc.setFontSize(9);
    doc.text("PRODUTOS", mx+4, y+4); y += 10;

    let subtotal = 0;
    for (let i=0; i<produtosAdicionados.length; i++) {
      const produto = produtosAdicionados[i];
      const textoX = mx+4+(produto.foto?35:0);
      const larguraTexto = sw-(produto.foto?41:8);
      const linhas = [];
      linhas.push(...doc.splitTextToSize(`${i+1}. ${normalizarTextoPdf(produto.nome)}`, larguraTexto));
      linhas.push(...doc.splitTextToSize(`Medidas: ${normalizarTextoPdf(produto.largura)} x ${normalizarTextoPdf(produto.altura)} mm | Vidro: ${normalizarTextoPdf(produto.vidro)}`, larguraTexto));
      if (produto.corNome) linhas.push(...doc.splitTextToSize(`Cor: ${normalizarTextoPdf(produto.corNome)}`, larguraTexto-8));
      const linhaQtd = produto.area
        ? `Qtd: ${normalizarTextoPdf(produto.quantidade)} | Area: ${normalizarTextoPdf(produto.area)} m2 | V. Unit.: R$ ${formatarMoeda(produto.valorUnitario)}`
        : `Qtd: ${normalizarTextoPdf(produto.quantidade)} | V. Unit.: R$ ${formatarMoeda(produto.valorUnitario)}`;
      linhas.push(...doc.splitTextToSize(linhaQtd, larguraTexto));
      linhas.push(...doc.splitTextToSize(`VALOR TOTAL: R$ ${formatarMoeda(produto.valorTotal)}`, larguraTexto));
      const alturaTexto = Math.max(26, linhas.length*4.2+6);
      const alturaBloco = Math.max(alturaTexto, produto.foto?30:0)+8;
      garantirEspaco(alturaBloco+4);
      doc.setDrawColor(...PDF_CORES.borda); doc.setFillColor(255,255,255);
      doc.roundedRect(mx,y,sw,alturaBloco,2,2,"S");
      if (produto.foto) {
        try { doc.addImage(produto.foto, getImageFormat(produto.foto), mx+4,y+4,27,27); } catch {}
      }
      doc.setFontSize(8); doc.setTextColor(...PDF_CORES.texto); doc.setFont(undefined,"normal");
      let linhaY = y+7;
      linhas.forEach((linha,idx) => {
        doc.setFont(undefined, (idx===0||linha.startsWith("VALOR TOTAL"))?"bold":"normal");
        doc.text(normalizarTextoPdf(linha), textoX, linhaY);
        linhaY += 4.2;
      });
      if (produto.corNome) {
        const [r,g,b] = hexParaRgb(produto.corHex);
        doc.setFillColor(r,g,b); doc.rect(textoX, y+Math.min(15.2,alturaBloco-10),3,3,"F");
      }
      subtotal += parseNumero(produto.valorTotal);
      y += alturaBloco+4;
    }

    const valorDesconto = subtotal*(percentualDesconto/100);
    const valorFinal = subtotal-valorDesconto;
    garantirEspaco(36,"ORCAMENTO (RESUMO)");
    doc.setDrawColor(...PDF_CORES.borda); doc.setFillColor(...PDF_CORES.cinzaClaro);
    doc.roundedRect(pw-78,y,68,percentualDesconto>0?24:18,2,2,"FD");
    doc.setFontSize(8.5); doc.setTextColor(...PDF_CORES.texto); doc.setFont(undefined,"normal");
    doc.text("Subtotal:", pw-72, y+6);
    doc.text(`R$ ${formatarMoeda(subtotal)}`, pw-14, y+6, {align:"right"});
    let resumoY = y+11;
    if (percentualDesconto>0) {
      doc.text(`Desconto (${percentualDesconto.toFixed(1)}%):`, pw-72, resumoY);
      doc.text(`- R$ ${formatarMoeda(valorDesconto)}`, pw-14, resumoY, {align:"right"});
      resumoY += 5;
    }
    doc.setFont(undefined,"bold"); doc.setTextColor(...PDF_CORES.verde);
    doc.text("Valor Final:", pw-72, resumoY);
    doc.text(`R$ ${formatarMoeda(valorFinal)}`, pw-14, resumoY, {align:"right"});
    y += percentualDesconto>0?30:24;

    doc.setFontSize(7.5); doc.setTextColor(...PDF_CORES.verde); doc.setFont(undefined,"normal");
    doc.text("Formas de pagamento: Cartao de credito/debito, Pix e cheque.", mx, ph-18);
    doc.setDrawColor(...PDF_CORES.borda);
    doc.line(mx+8,ph-9,mx+68,ph-9); doc.line(pw-78,ph-9,pw-18,ph-9);
    doc.setFontSize(7); doc.setTextColor(...PDF_CORES.texto);
    doc.text("Assinatura do Cliente", mx+20, ph-5.5);
    doc.text("Assinatura da VIDROART", pw-66, ph-5.5);

    // Salvar PDF — tenta Filesystem do Capacitor primeiro, fallback para download web
    const pdfBase64 = doc.output("datauristring").split(",")[1];
    const nomeArquivo = criarNomeArquivo(clienteNome, numeroOrcamento);
    const Filesystem = getFilesystem();

    if (Filesystem) {
      try {
        await Filesystem.writeFile({
          path: nomeArquivo,
          data: pdfBase64,
          directory: "DOWNLOADS",
          recursive: true
        });
        mostrarAviso("PDF salvo na pasta Downloads do celular!");
      } catch (e) {
        // Fallback: tenta Documents
        try {
          await Filesystem.writeFile({
            path: nomeArquivo,
            data: pdfBase64,
            directory: "DOCUMENTS",
            recursive: true
          });
          mostrarAviso("PDF salvo na pasta Documentos do celular!");
        } catch {
          // Último fallback: download via blob
          doc.save(nomeArquivo);
          mostrarAviso("PDF gerado com sucesso!");
        }
      }
    } else {
      doc.save(nomeArquivo);
      mostrarAviso("PDF gerado com sucesso!");
    }

    const resultado = registrarOrcamentoNoHistorico({
      id: numeroOrcamento,
      cliente: clienteNome||"Cliente nao informado",
      nome: produtosAdicionados.map(p=>p.nome).join(", ")||"Orcamento sem produtos",
      data: dataOrcamento, dataISO: dataAtual.toISOString(),
      valor: valorFinal.toFixed(2), desconto: percentualDesconto,
      produtos: produtosAdicionados,
      dadosCliente: { nome:clienteNome, telefone:clienteTelefone, email:clienteEmail, endereco:clienteEndereco },
      concluido: false
    });

    if (!resultado.salvouFotos) {
      mostrarAviso("Historico salvo sem fotos para economizar espaco.");
    }

  } catch (error) {
    console.error("Erro ao gerar PDF:", error);
    alert(`Erro ao gerar PDF: ${error.message}`);
  }
}

// ── Modal Histórico ────────────────────────────────────────────────────────────
function renderizarHistorico() {
  const modal = getElement("modalHistorico");
  const lista = getElement("listaHistorico");
  if (!modal || !lista) return;
  const historico = obterHistorico();
  lista.innerHTML = "";
  if (historico.length === 0) {
    lista.innerHTML = '<li class="empty-message">Nenhum orcamento salvo ainda.</li>';
    modal.classList.remove("hidden"); modal.setAttribute("aria-hidden","false"); return;
  }
  historico.slice().reverse().forEach((item, i) => {
    const realIndex = historico.length-1-i;
    const primeiraFoto = item.produtos?.[0]?.foto || "";
    const concluido = item.concluido === true;
    const li = document.createElement("li");
    li.className = "history-item";
    li.innerHTML = `
      <div class="history-main">
        ${primeiraFoto ? `<img src="${primeiraFoto}" class="history-thumb" alt="Previa">` : ""}
        <div class="history-meta">
          <span class="history-client">${escapeHtml(item.cliente||"Cliente nao informado")}</span>
          <span class="history-name">${escapeHtml(item.nome||"Sem descricao")}</span>
          <span class="history-date">${escapeHtml(item.data||"")}</span>
        </div>
      </div>
      <div class="history-side">
        <span class="history-price">R$ ${formatarMoeda(item.valor)}</span>
        <div class="history-actions">
          <button type="button" class="history-btn whatsapp" onclick="enviarWhatsApp(${realIndex})">Enviar</button>
          <button type="button" class="history-btn edit" onclick="editarOrcamento(${realIndex})">Editar</button>
          <button type="button" class="history-btn delete" onclick="removerOrcamento(${realIndex})">Excluir</button>
          ${concluido
            ? '<button type="button" class="history-btn done" disabled>Concluido</button>'
            : `<button type="button" class="history-btn complete" onclick="concluirVenda(${realIndex})">Concluir</button>`}
        </div>
      </div>`;
    lista.appendChild(li);
  });
  modal.classList.remove("hidden"); modal.setAttribute("aria-hidden","false");
}

function abrirHistorico() { renderizarHistorico(); }

function fecharHistorico() {
  const modal = getElement("modalHistorico");
  if (!modal) return;
  modal.classList.add("hidden"); modal.setAttribute("aria-hidden","true");
}

function configurarModalHistorico() {
  getElement("btnHistorico")?.addEventListener("click", abrirHistorico);
  getElement("fecharHistorico")?.addEventListener("click", fecharHistorico);
  getElement("limparHistorico")?.addEventListener("click", () => {
    if (!confirm("Deseja apagar todo o historico?")) return;
    localStorage.removeItem("historicoPDFs");
    renderizarHistorico();
  });
  getElement("modalHistorico")?.addEventListener("click", (e) => {
    if (e.target instanceof HTMLElement && e.target.dataset.closeModal === "true") fecharHistorico();
  });
}

window.editarOrcamento = function(index) {
  const historico = obterHistorico();
  const orc = historico[index];
  if (!orc) { alert("Orcamento nao encontrado."); return; }
  fecharHistorico();
  const dados = orc.dadosCliente || {};
  setValue("clienteNome", dados.nome||orc.cliente||"");
  setValue("clienteTelefone", dados.telefone||"");
  setValue("clienteEmail", dados.email||"");
  setValue("clienteEndereco", dados.endereco||"");
  if (getElement("percentualDesconto")) {
    getElement("percentualDesconto").value = String(parseNumero(orc.desconto));
    if (getElement("valorDescontoLabel")) getElement("valorDescontoLabel").textContent = `${parseNumero(orc.desconto)}%`;
  }
  produtosAdicionados = Array.isArray(orc.produtos) ? orc.produtos.map(p=>({...p})) : [];
  renderizarProdutosAdicionados();
  limparCamposProduto();
  mostrarAviso(`Editando orcamento de ${dados.nome||orc.cliente||"cliente"}.`);
  getElement("orcamento")?.scrollIntoView({ behavior:"smooth" });
};

window.removerOrcamento = function(index) {
  const historico = obterHistorico();
  const item = historico[index];
  if (!item) { alert("Orcamento nao encontrado."); return; }
  if (!confirm(`Deseja realmente excluir o orcamento de ${item.cliente||"cliente"}?`)) return;
  historico.splice(index,1);
  salvarHistorico(historico);
  renderizarHistorico();
};

window.enviarWhatsApp = function(index) {
  const historico = obterHistorico();
  const item = historico[index];
  if (!item) { alert("Orcamento nao encontrado."); return; }
  const numero = String(item.dadosCliente?.telefone||"").replace(/\D/g,"");
  if (!numero) { alert("Esse orcamento salvo nao possui telefone."); return; }
  const msg = encodeURIComponent(`Ola ${item.cliente||"cliente"}, tudo bem?\n\nSegue seu orcamento da VIDROART.\nValor total: R$ ${formatarMoeda(item.valor)}`);
  window.open(`https://wa.me/55${numero}?text=${msg}`, "_blank");
};

window.concluirVenda = function(index) {
  const historico = obterHistorico();
  if (!historico[index]) return;
  if (!confirm(`Marcar o orcamento de ${historico[index].cliente||"cliente"} como concluido?`)) return;
  historico[index].concluido = true;
  salvarHistorico(historico);
  renderizarHistorico();
};

// ── Progress bar & Slider ──────────────────────────────────────────────────────
function updateProgressBar() {
  const bar = getElement("progressBar");
  if (!bar) return;
  const atualizar = () => {
    const p = document.documentElement.scrollHeight-window.innerHeight;
    bar.style.width = p>0 ? `${(window.scrollY/p)*100}%` : "0%";
  };
  window.addEventListener("scroll", atualizar);
  atualizar();
}

function configurarSliderDesconto() {
  const slider = getElement("percentualDesconto");
  const label = getElement("valorDescontoLabel");
  if (!slider||!label) return;
  const atualizar = () => { label.textContent = `${slider.value}%`; };
  slider.addEventListener("input", atualizar);
  atualizar();
}

// ── Init ───────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  alternarModoEdicao(false);
  configurarSliderDesconto();
  configurarModalHistorico();
  updateProgressBar();
  renderizarProdutosAdicionados();
});

window.adicionarProduto = adicionarProduto;
window.editarProduto = editarProduto;
window.removerProduto = removerProduto;
window.salvarEdicaoProduto = salvarEdicaoProduto;
window.limparCamposProduto = limparCamposProduto;
window.gerarPDF = gerarPDF;
window.tirarFotoComCamera = tirarFotoComCamera;