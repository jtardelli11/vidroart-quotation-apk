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

function getElement(id) {
  return document.getElementById(id);
}

function getValue(id, defaultValue = "") {
  const element = getElement(id);
  if (!element) return defaultValue;
  if (typeof element.value !== "string") return defaultValue;
  return element.value.trim();
}

function setValue(id, value) {
  const element = getElement(id);
  if (element) {
    element.value = value;
  }
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[char]));
}

function normalizarTextoPdf(texto) {
  return String(texto ?? "")
    .normalize("NFC")
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[^\u0000-\u00FF]/g, "")
    .trim();
}

function parseNumero(valor) {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;

  const texto = String(valor ?? "")
    .replace(/\s/g, "")
    .replace("R$", "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");

  const numero = parseFloat(texto);
  return Number.isFinite(numero) ? numero : 0;
}

function formatarMoeda(valor) {
  return parseNumero(valor).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatarData(data = new Date()) {
  return new Intl.DateTimeFormat("pt-BR").format(data);
}

function normalizarHexCor(cor) {
  return /^#[0-9a-f]{6}$/i.test(String(cor || "")) ? cor : "#ffffff";
}

function hexParaRgb(hex) {
  const cor = normalizarHexCor(hex).replace("#", "");
  return [
    parseInt(cor.slice(0, 2), 16),
    parseInt(cor.slice(2, 4), 16),
    parseInt(cor.slice(4, 6), 16)
  ];
}

function getImageFormat(dataUrl) {
  if (typeof dataUrl !== "string") return "JPEG";
  if (dataUrl.startsWith("data:image/png")) return "PNG";
  return "JPEG";
}

function calcularAreaProduto(largura, altura, quantidade) {
  const larguraM = parseNumero(largura) / 1000;
  const alturaM = parseNumero(altura) / 1000;
  const qtd = parseNumero(quantidade);
  const area = larguraM * alturaM * qtd;
  return area > 0 ? area.toFixed(2) : "";
}

function gerarNumeroOrcamento() {
  const agora = new Date();
  const data = `${agora.getFullYear()}${String(agora.getMonth() + 1).padStart(2, "0")}${String(agora.getDate()).padStart(2, "0")}`;
  const aleatorio = Math.floor(Math.random() * 9000) + 1000;
  return `ORC-${data}-${aleatorio}`;
}

function criarNomeArquivo(cliente, numeroOrcamento) {
  const clienteLimpo = String(cliente || "cliente")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();

  return `orcamento-${clienteLimpo || "cliente"}-${numeroOrcamento.toLowerCase()}.pdf`;
}

function mostrarAviso(texto, tipo = "success") {
  const aviso = document.createElement("div");
  aviso.textContent = texto;
  aviso.className = `fixed top-4 left-1/2 -translate-x-1/2 ${tipo === "error" ? "bg-red-600" : "bg-green-600"} text-white px-6 py-3 rounded-full shadow-lg z-50`;
  document.body.appendChild(aviso);
  setTimeout(() => aviso.remove(), 2800);
}

function alternarModoEdicao(ativo) {
  getElement("adicionarProdutoBtn")?.classList.toggle("hidden", ativo);
  getElement("salvarEdicaoBtn")?.classList.toggle("hidden", !ativo);
}

function obterHistorico() {
  try {
    const historico = JSON.parse(localStorage.getItem("historicoPDFs"));
    return Array.isArray(historico) ? historico : [];
  } catch (error) {
    console.warn("Erro ao ler historico:", error);
    return [];
  }
}

function salvarHistorico(historico) {
  localStorage.setItem("historicoPDFs", JSON.stringify(historico));
}

function lerArquivoComoDataURL(fileOrBlob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target?.result || "");
    reader.onerror = reject;
    reader.readAsDataURL(fileOrBlob);
  });
}

function carregarImagem(dataUrl) {
  return new Promise((resolve, reject) => {
    const imagem = new Image();
    imagem.onload = () => resolve(imagem);
    imagem.onerror = reject;
    imagem.src = dataUrl;
  });
}

async function normalizarImagemParaDataUrl(dataUrl, options = {}) {
  const {
    maxWidth = 1400,
    maxHeight = 1400,
    mimeType = "image/jpeg",
    quality = 0.82,
    fundo = "#ffffff"
  } = options;

  if (!dataUrl) return "";

  try {
    const imagem = await carregarImagem(dataUrl);
    const scale = Math.min(maxWidth / imagem.width, maxHeight / imagem.height, 1);
    const width = Math.max(1, Math.round(imagem.width * scale));
    const height = Math.max(1, Math.round(imagem.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;

    if (mimeType === "image/jpeg") {
      ctx.fillStyle = fundo;
      ctx.fillRect(0, 0, width, height);
    }

    ctx.drawImage(imagem, 0, 0, width, height);
    return canvas.toDataURL(mimeType, quality);
  } catch (error) {
    console.warn("Nao foi possivel normalizar imagem:", error);
    return dataUrl;
  }
}

async function obterImagemProdutoNormalizada(file) {
  const dataUrl = await lerArquivoComoDataURL(file);
  return normalizarImagemParaDataUrl(dataUrl, {
    maxWidth: 1280,
    maxHeight: 1280,
    mimeType: "image/jpeg",
    quality: 0.8
  });
}

async function obterLogoPdf() {
  if (!logoPdfPromise) {
    logoPdfPromise = (async () => {
      try {
        const response = await fetch(EMPRESA.logoUrl, { cache: "force-cache" });
        const blob = await response.blob();
        const rawDataUrl = await lerArquivoComoDataURL(blob);
        return normalizarImagemParaDataUrl(rawDataUrl, {
          maxWidth: 420,
          maxHeight: 420,
          mimeType: "image/png",
          quality: 1
        });
      } catch (error) {
        console.warn("Nao foi possivel carregar a logo:", error);
        return "";
      }
    })();
  }

  return logoPdfPromise;
}

async function montarProdutoAPartirDoFormulario(fotoExistente = "") {
  const nomeProduto = getValue("produtoNome");
  const largura = getValue("produtoLargura");
  const altura = getValue("produtoAltura");
  const qtd = getValue("produtoQtd", "1");
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
  }

  return {
    nome: nomeProduto,
    largura,
    altura,
    quantidade: String(quantidade),
    vidro,
    area: areaInformada || calcularAreaProduto(largura, altura, quantidade),
    valorUnitario: valorUnitario.toFixed(2),
    valorTotal: Number((valorUnitario * quantidade).toFixed(2)),
    foto,
    corHex,
    corNome
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
  const listaProdutosDiv = getElement("listaProdutos");
  if (!listaProdutosDiv) return;

  listaProdutosDiv.innerHTML = "";

  if (produtosAdicionados.length === 0) {
    listaProdutosDiv.innerHTML = '<p class="empty-message" id="noProductsMessage">Nenhum produto adicionado ainda.</p>';
    return;
  }

  produtosAdicionados.forEach((produto, index) => {
    const productItemDiv = document.createElement("div");
    productItemDiv.className = "product-item";
    productItemDiv.innerHTML = `
      ${produto.foto ? `<img src="${produto.foto}" alt="${escapeHtml(produto.nome)}">` : ""}
      <div>
        <p class="font-semibold">${escapeHtml(produto.nome)} (${escapeHtml(produto.largura)}x${escapeHtml(produto.altura)}mm)</p>
        <p class="text-sm">
          Qtd: ${escapeHtml(produto.quantidade)} | Vidro: ${escapeHtml(produto.vidro)}
          ${produto.corNome ? ` | Cor: <span class="color-box" style="background-color: ${normalizarHexCor(produto.corHex)};"></span>${escapeHtml(produto.corNome)}` : ""}
          ${produto.area ? ` | Area: ${escapeHtml(produto.area)}m2` : ""}
        </p>
        <p class="text-md font-bold">
          Valor Unitario: R$ ${formatarMoeda(produto.valorUnitario)} |
          Valor Total: R$ ${formatarMoeda(produto.valorTotal)}
        </p>
      </div>
      <div class="action-buttons">
        <button type="button" class="edit-btn" onclick="editarProduto(${index})" title="Editar produto">
          <i class="fas fa-edit"></i>
        </button>
        <button type="button" class="delete-btn" onclick="removerProduto(${index})" title="Remover produto">
          <i class="fas fa-trash-alt"></i>
        </button>
      </div>
    `;
    listaProdutosDiv.appendChild(productItemDiv);
  });
}

function limparCamposProduto() {
  setValue("produtoNome", "");
  setValue("produtoLargura", "");
  setValue("produtoAltura", "");
  setValue("produtoQtd", "1");
  setValue("produtoVidro", "");
  setValue("produtoArea", "");
  setValue("produtoUnitario", "");
  setValue("produtoCorNome", "");
  if (getElement("produtoFoto")) getElement("produtoFoto").value = "";
  if (getElement("produtoCor")) getElement("produtoCor").value = "#ffffff";

  produtoEmEdicaoIndex = -1;
  alternarModoEdicao(false);
}

function editarProduto(index) {
  const produto = produtosAdicionados[index];
  if (!produto) return;

  setValue("produtoNome", produto.nome || "");
  setValue("produtoLargura", produto.largura || "");
  setValue("produtoAltura", produto.altura || "");
  setValue("produtoQtd", produto.quantidade || "1");
  setValue("produtoVidro", produto.vidro || "");
  setValue("produtoArea", produto.area || "");
  setValue("produtoUnitario", produto.valorUnitario || "");
  setValue("produtoCorNome", produto.corNome || "");
  if (getElement("produtoCor")) getElement("produtoCor").value = normalizarHexCor(produto.corHex);
  if (getElement("produtoFoto")) getElement("produtoFoto").value = "";

  produtoEmEdicaoIndex = index;
  alternarModoEdicao(true);
  getElement("orcamento")?.scrollIntoView({ behavior: "smooth" });
}

async function salvarEdicaoProduto() {
  if (produtoEmEdicaoIndex === -1 || !produtosAdicionados[produtoEmEdicaoIndex]) {
    alert("Nenhum produto selecionado para edicao.");
    return;
  }

  const produtoAtualizado = await montarProdutoAPartirDoFormulario(
    produtosAdicionados[produtoEmEdicaoIndex]?.foto || ""
  );

  if (!produtoAtualizado) return;

  produtosAdicionados[produtoEmEdicaoIndex] = produtoAtualizado;
  renderizarProdutosAdicionados();
  limparCamposProduto();
}

function removerProduto(index) {
  if (!produtosAdicionados[index]) return;
  if (!confirm("Tem certeza que deseja remover este produto?")) return;

  produtosAdicionados.splice(index, 1);

  if (produtoEmEdicaoIndex === index) {
    limparCamposProduto();
  } else if (produtoEmEdicaoIndex > index) {
    produtoEmEdicaoIndex -= 1;
  }

  renderizarProdutosAdicionados();
  alternarModoEdicao(produtoEmEdicaoIndex !== -1);
}

function registrarOrcamentoNoHistorico(registro) {
  const historico = obterHistorico();
  const novoRegistro = {
    ...registro,
    produtos: registro.produtos.map((produto) => ({ ...produto }))
  };

  try {
    salvarHistorico([...historico, novoRegistro]);
    return { salvouFotos: true };
  } catch (error) {
    const quota = error?.name === "QuotaExceededError" || /quota/i.test(String(error?.message || ""));
    if (!quota) throw error;

    const registroSemFotos = {
      ...novoRegistro,
      produtos: novoRegistro.produtos.map((produto) => ({
        ...produto,
        foto: ""
      }))
    };

    salvarHistorico([...historico, registroSemFotos]);
    return { salvouFotos: false };
  }
}

function desenharLinhaCabecalho(doc, x, y, label, value) {
  doc.setFont(undefined, "bold");
  doc.text(`${normalizarTextoPdf(label)}:`, x, y);
  doc.setFont(undefined, "normal");
  doc.text(normalizarTextoPdf(value || "-"), x + 20, y);
}

function desenharTituloPagina(doc, titulo, y, pageWidth) {
  const texto = normalizarTextoPdf(titulo);
  doc.setFontSize(18);
  doc.setTextColor(...PDF_CORES.verde);
  doc.setFont(undefined, "bold");
  const largura = doc.getTextWidth(texto) + 10;
  const x = (pageWidth - largura) / 2;
  doc.setFillColor(...PDF_CORES.cinzaClaro);
  doc.roundedRect(x, y, largura, 9, 2, 2, "F");
  doc.setDrawColor(...PDF_CORES.verde);
  doc.roundedRect(x, y, largura, 9, 2, 2, "S");
  doc.text(texto, pageWidth / 2, y + 6, { align: "center" });
}

function desenharCabecalhoPdf(doc, logoDataUrl) {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(...PDF_CORES.verde);
  doc.rect(0, 0, pageWidth, 22, "F");

  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, getImageFormat(logoDataUrl), 9, 3, 16, 16);
    } catch (error) {
      console.warn("Nao foi possivel inserir logo no PDF:", error);
    }
  } else {
    doc.setFontSize(14);
    doc.setTextColor(...PDF_CORES.branco);
    doc.setFont(undefined, "bold");
    doc.text(EMPRESA.nome, 9, 13);
  }

  doc.setFontSize(7.5);
  doc.setTextColor(...PDF_CORES.branco);
  doc.setFont(undefined, "normal");
  doc.text(normalizarTextoPdf(EMPRESA.endereco), pageWidth - 9, 5, { align: "right" });
  doc.text(`CNPJ: ${EMPRESA.cnpj}`, pageWidth - 9, 9, { align: "right" });
  doc.text(`Telefone: ${EMPRESA.telefone}`, pageWidth - 9, 13, { align: "right" });
  doc.text(`WhatsApp: ${EMPRESA.whatsapp}`, pageWidth - 9, 17, { align: "right" });
}

async function gerarPDF() {
  if (produtosAdicionados.length === 0) {
    alert("Adicione pelo menos um produto antes de gerar o PDF.");
    return;
  }

  if (!window.jspdf?.jsPDF) {
    alert("A biblioteca jsPDF nao foi carregada.");
    return;
  }

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: "p",
      unit: "mm",
      format: "a4",
      compress: true
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 10;
    const sectionWidth = pageWidth - marginX * 2;
    const rodapeReservado = 30;
    const logoPdf = await obterLogoPdf();

    const clienteNome = getValue("clienteNome");
    const clienteTelefone = getValue("clienteTelefone");
    const clienteEmail = getValue("clienteEmail");
    const clienteEndereco = getValue("clienteEndereco");

    const dataAtual = new Date();
    const dataOrcamento = formatarData(dataAtual);
    const numeroOrcamento = gerarNumeroOrcamento();
    const percentualDesconto = parseNumero(getElement("percentualDesconto")?.value);

    let y = 0;
    let primeiraPaginaDesenhada = false;

    const abrirNovaPagina = (titulo = "ORCAMENTO") => {
      if (primeiraPaginaDesenhada) {
        doc.addPage();
      }

      desenharCabecalhoPdf(doc, logoPdf);
      y = 28;
      desenharTituloPagina(doc, titulo, y, pageWidth);
      y += 15;
      primeiraPaginaDesenhada = true;
    };

    const garantirEspaco = (alturaNecessaria, titulo = "ORCAMENTO (CONT.)") => {
      if (y + alturaNecessaria <= pageHeight - rodapeReservado) return;
      abrirNovaPagina(titulo);
    };

    abrirNovaPagina();

    doc.setFillColor(...PDF_CORES.cinzaClaro);
    doc.setDrawColor(...PDF_CORES.borda);
    doc.roundedRect(marginX, y, sectionWidth, 34, 2, 2, "FD");

    doc.setFontSize(9);
    doc.setTextColor(...PDF_CORES.verde);
    doc.setFont(undefined, "bold");
    doc.text("DADOS DO CLIENTE", marginX + 4, y + 5);

    doc.setFontSize(8);
    doc.setTextColor(...PDF_CORES.texto);
    desenharLinhaCabecalho(doc, marginX + 4, y + 10, "Nome", clienteNome || "Cliente nao informado");
    desenharLinhaCabecalho(doc, marginX + 4, y + 14.5, "Telefone", clienteTelefone || "-");
    desenharLinhaCabecalho(doc, marginX + 4, y + 19, "E-mail", clienteEmail || "-");

    const enderecoQuebrado = doc.splitTextToSize(
      normalizarTextoPdf(clienteEndereco || "-"),
      sectionWidth - 34
    );
    doc.setFont(undefined, "bold");
    doc.text("Endereco:", marginX + 4, y + 23.5);
    doc.setFont(undefined, "normal");
    doc.text(enderecoQuebrado, marginX + 24, y + 23.5);

    doc.setFont(undefined, "bold");
    doc.text("Data:", marginX + 4, y + 30);
    doc.setFont(undefined, "normal");
    doc.text(dataOrcamento, marginX + 24, y + 30);
    doc.setFont(undefined, "bold");
    doc.text("No:", pageWidth - 72, y + 30);
    doc.setFont(undefined, "normal");
    doc.text(numeroOrcamento, pageWidth - 60, y + 30);

    y += 42;

    doc.setFillColor(...PDF_CORES.verde);
    doc.rect(marginX, y, sectionWidth, 6, "F");
    doc.setTextColor(...PDF_CORES.branco);
    doc.setFont(undefined, "bold");
    doc.setFontSize(9);
    doc.text("PRODUTOS", marginX + 4, y + 4);
    y += 10;

    let subtotal = 0;

    for (let i = 0; i < produtosAdicionados.length; i += 1) {
      const produto = produtosAdicionados[i];
      const textoX = marginX + 4 + (produto.foto ? 35 : 0);
      const larguraTexto = sectionWidth - (produto.foto ? 41 : 8);

      const linhas = [];
      linhas.push(...doc.splitTextToSize(
        `${i + 1}. ${normalizarTextoPdf(produto.nome)}`,
        larguraTexto
      ));
      linhas.push(...doc.splitTextToSize(
        `Medidas: ${normalizarTextoPdf(produto.largura)} x ${normalizarTextoPdf(produto.altura)} mm | Vidro: ${normalizarTextoPdf(produto.vidro)}`,
        larguraTexto
      ));

      if (produto.corNome) {
        linhas.push(...doc.splitTextToSize(
          `Cor: ${normalizarTextoPdf(produto.corNome)}`,
          larguraTexto - 8
        ));
      }

      const linhaQtd = produto.area
        ? `Qtd: ${normalizarTextoPdf(produto.quantidade)} | Area: ${normalizarTextoPdf(produto.area)} m2 | V. Unit.: R$ ${formatarMoeda(produto.valorUnitario)}`
        : `Qtd: ${normalizarTextoPdf(produto.quantidade)} | V. Unit.: R$ ${formatarMoeda(produto.valorUnitario)}`;

      linhas.push(...doc.splitTextToSize(linhaQtd, larguraTexto));
      linhas.push(...doc.splitTextToSize(
        `VALOR TOTAL: R$ ${formatarMoeda(produto.valorTotal)}`,
        larguraTexto
      ));

      const alturaTexto = Math.max(26, linhas.length * 4.2 + 6);
      const alturaImagem = produto.foto ? 30 : 0;
      const alturaBloco = Math.max(alturaTexto, alturaImagem) + 8;

      garantirEspaco(alturaBloco + 4);

      doc.setDrawColor(...PDF_CORES.borda);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(marginX, y, sectionWidth, alturaBloco, 2, 2, "S");

      if (produto.foto) {
        try {
          doc.addImage(produto.foto, getImageFormat(produto.foto), marginX + 4, y + 4, 27, 27);
        } catch (error) {
          console.warn("Nao foi possivel inserir imagem do produto no PDF:", error);
        }
      }

      doc.setFontSize(8);
      doc.setTextColor(...PDF_CORES.texto);
      doc.setFont(undefined, "normal");

      let linhaY = y + 7;
      linhas.forEach((linha, idx) => {
        if (idx === 0 || linha.startsWith("VALOR TOTAL")) {
          doc.setFont(undefined, "bold");
        } else {
          doc.setFont(undefined, "normal");
        }
        doc.text(normalizarTextoPdf(linha), textoX, linhaY);
        linhaY += 4.2;
      });

      if (produto.corNome) {
        const [r, g, b] = hexParaRgb(produto.corHex);
        const posicaoCor = y + Math.min(15.2, alturaBloco - 10);
        doc.setFillColor(r, g, b);
        doc.rect(textoX, posicaoCor, 3, 3, "F");
      }

      subtotal += parseNumero(produto.valorTotal);
      y += alturaBloco + 4;
    }

    const valorDesconto = subtotal * (percentualDesconto / 100);
    const valorFinal = subtotal - valorDesconto;

    garantirEspaco(36, "ORCAMENTO (RESUMO)");

    doc.setDrawColor(...PDF_CORES.borda);
    doc.setFillColor(...PDF_CORES.cinzaClaro);
    doc.roundedRect(pageWidth - 78, y, 68, percentualDesconto > 0 ? 24 : 18, 2, 2, "FD");

    doc.setFontSize(8.5);
    doc.setTextColor(...PDF_CORES.texto);
    doc.setFont(undefined, "normal");
    doc.text("Subtotal:", pageWidth - 72, y + 6);
    doc.text(`R$ ${formatarMoeda(subtotal)}`, pageWidth - 14, y + 6, { align: "right" });

    let resumoY = y + 11;
    if (percentualDesconto > 0) {
      doc.text(`Desconto (${percentualDesconto.toFixed(1)}%):`, pageWidth - 72, resumoY);
      doc.text(`- R$ ${formatarMoeda(valorDesconto)}`, pageWidth - 14, resumoY, { align: "right" });
      resumoY += 5;
    }

    doc.setFont(undefined, "bold");
    doc.setTextColor(...PDF_CORES.verde);
    doc.text("Valor Final:", pageWidth - 72, resumoY);
    doc.text(`R$ ${formatarMoeda(valorFinal)}`, pageWidth - 14, resumoY, { align: "right" });

    y += percentualDesconto > 0 ? 30 : 24;

    garantirEspaco(22, "ORCAMENTO (FINAL)");

    doc.setFontSize(7.5);
    doc.setTextColor(...PDF_CORES.verde);
    doc.setFont(undefined, "normal");
    doc.text("Formas de pagamento: Cartao de credito/debito, Pix e cheque.", marginX, pageHeight - 18);

    doc.setDrawColor(...PDF_CORES.borda);
    doc.line(marginX + 8, pageHeight - 9, marginX + 68, pageHeight - 9);
    doc.line(pageWidth - 78, pageHeight - 9, pageWidth - 18, pageHeight - 9);
    doc.setFontSize(7);
    doc.setTextColor(...PDF_CORES.texto);
    doc.text("Assinatura do Cliente", marginX + 20, pageHeight - 5.5);
    doc.text("Assinatura da VIDROART", pageWidth - 66, pageHeight - 5.5);

    const resultadoHistorico = registrarOrcamentoNoHistorico({
      id: numeroOrcamento,
      cliente: clienteNome || "Cliente nao informado",
      nome: produtosAdicionados.map((produto) => produto.nome).join(", ") || "Orcamento sem produtos",
      data: dataOrcamento,
      dataISO: dataAtual.toISOString(),
      valor: valorFinal.toFixed(2),
      desconto: percentualDesconto,
      produtos: produtosAdicionados,
      dadosCliente: {
        nome: clienteNome,
        telefone: clienteTelefone,
        email: clienteEmail,
        endereco: clienteEndereco
      },
      concluido: false
    });

    atualizarGestaoFinanceira();

    const nomeArquivo = criarNomeArquivo(clienteNome, numeroOrcamento);
    doc.save(nomeArquivo);

    if (resultadoHistorico.salvouFotos) {
      mostrarAviso("PDF gerado com sucesso e salvo no historico.");
    } else {
      mostrarAviso("PDF gerado. O historico foi salvo sem fotos para evitar erro de armazenamento.");
    }
  } catch (error) {
    console.error("Erro ao gerar PDF:", error);
    alert(`Erro ao gerar PDF: ${error.message}`);
  }
}

function renderizarHistorico() {
  const modalHistorico = getElement("modalHistorico");
  const listaHistorico = getElement("listaHistorico");
  if (!modalHistorico || !listaHistorico) return;

  const historico = obterHistorico();
  listaHistorico.innerHTML = "";

  if (historico.length === 0) {
    listaHistorico.innerHTML = '<li class="empty-message">Nenhum orcamento salvo ainda.</li>';
    modalHistorico.classList.remove("hidden");
    modalHistorico.setAttribute("aria-hidden", "false");
    return;
  }

  historico
    .slice()
    .reverse()
    .forEach((item, i) => {
      const realIndex = historico.length - 1 - i;
      const primeiraFoto = item.produtos?.[0]?.foto || "";
      const concluido = item.concluido === true;

      const li = document.createElement("li");
      li.className = "history-item";
      li.innerHTML = `
        <div class="history-main">
          ${primeiraFoto ? `<img src="${primeiraFoto}" class="history-thumb" alt="Previa do orcamento">` : ""}
          <div class="history-meta">
            <span class="history-client">${escapeHtml(item.cliente || "Cliente nao informado")}</span>
            <span class="history-name">${escapeHtml(item.nome || "Sem descricao")}</span>
            <span class="history-date">${escapeHtml(item.data || "")}</span>
          </div>
        </div>
        <div class="history-side">
          <span class="history-price">R$ ${formatarMoeda(item.valor)}</span>
          <div class="history-actions">
            <button type="button" class="history-btn whatsapp" onclick="enviarWhatsApp(${realIndex})">Enviar</button>
            <button type="button" class="history-btn edit" onclick="editarOrcamento(${realIndex})">Editar</button>
            <button type="button" class="history-btn delete" onclick="removerOrcamento(${realIndex})">Excluir</button>
            ${
              concluido
                ? '<button type="button" class="history-btn done" disabled>Concluido</button>'
                : `<button type="button" class="history-btn complete" onclick="concluirVenda(${realIndex})">Concluir</button>`
            }
          </div>
        </div>
      `;

      listaHistorico.appendChild(li);
    });

  modalHistorico.classList.remove("hidden");
  modalHistorico.setAttribute("aria-hidden", "false");
}

function abrirHistorico() {
  atualizarGestaoFinanceira();
  renderizarHistorico();
}

function fecharHistorico() {
  const modalHistorico = getElement("modalHistorico");
  if (!modalHistorico) return;
  modalHistorico.classList.add("hidden");
  modalHistorico.setAttribute("aria-hidden", "true");
}

function configurarModalHistorico() {
  getElement("btnHistorico")?.addEventListener("click", abrirHistorico);
  getElement("fecharHistorico")?.addEventListener("click", fecharHistorico);
  getElement("limparHistorico")?.addEventListener("click", () => {
    if (!confirm("Deseja apagar todo o historico?")) return;
    localStorage.removeItem("historicoPDFs");
    atualizarGestaoFinanceira();
    renderizarHistorico();
  });

  getElement("modalHistorico")?.addEventListener("click", (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.dataset.closeModal === "true") {
      fecharHistorico();
    }
  });
}

window.editarOrcamento = function editarOrcamento(index) {
  const historico = obterHistorico();
  const orcamento = historico[index];
  if (!orcamento) {
    alert("Orcamento nao encontrado.");
    return;
  }

  fecharHistorico();

  const dados = orcamento.dadosCliente || {};
  setValue("clienteNome", dados.nome || orcamento.cliente || "");
  setValue("clienteTelefone", dados.telefone || "");
  setValue("clienteEmail", dados.email || "");
  setValue("clienteEndereco", dados.endereco || "");

  if (getElement("percentualDesconto")) {
    getElement("percentualDesconto").value = String(parseNumero(orcamento.desconto));
    if (getElement("valorDescontoLabel")) {
      getElement("valorDescontoLabel").textContent = `${parseNumero(orcamento.desconto)}%`;
    }
  }

  produtosAdicionados = Array.isArray(orcamento.produtos)
    ? orcamento.produtos.map((produto) => ({ ...produto }))
    : [];

  renderizarProdutosAdicionados();
  limparCamposProduto();
  mostrarAviso(`Editando orcamento de ${dados.nome || orcamento.cliente || "cliente"}.`);
  getElement("orcamento")?.scrollIntoView({ behavior: "smooth" });
};

window.removerOrcamento = function removerOrcamento(index) {
  const historico = obterHistorico();
  const item = historico[index];
  if (!item) {
    alert("Orcamento nao encontrado.");
    return;
  }

  if (!confirm(`Deseja realmente excluir o orcamento de ${item.cliente || "cliente"}?`)) return;

  historico.splice(index, 1);
  salvarHistorico(historico);
  atualizarGestaoFinanceira();
  renderizarHistorico();
};

window.enviarWhatsApp = function enviarWhatsApp(index) {
  const historico = obterHistorico();
  const item = historico[index];
  if (!item) {
    alert("Orcamento nao encontrado.");
    return;
  }

  const numeroCliente = String(item.dadosCliente?.telefone || "").replace(/\D/g, "");
  if (!numeroCliente) {
    alert("Esse orcamento salvo nao possui telefone.");
    return;
  }

  const mensagem = encodeURIComponent(
    `Ola ${item.cliente || "cliente"}, tudo bem?\n\nSegue seu orcamento da VIDROART.\nValor total: R$ ${formatarMoeda(item.valor)}`
  );

  window.open(`https://wa.me/55${numeroCliente}?text=${mensagem}`, "_blank");
};

window.concluirVenda = function concluirVenda(index) {
  const historico = obterHistorico();
  if (!historico[index]) return;

  if (!confirm(`Marcar o orcamento de ${historico[index].cliente || "cliente"} como concluido?`)) return;

  historico[index].concluido = true;
  salvarHistorico(historico);
  atualizarGestaoFinanceira();
  renderizarHistorico();
};

function atualizarGestaoFinanceira() {
  const historico = obterHistorico();
  const mesAtual = new Date().getMonth();
  const anoAtual = new Date().getFullYear();

  const orcamentosMes = historico.filter((orcamento) => {
    const data = orcamento.dataISO ? new Date(orcamento.dataISO) : new Date();
    return data.getMonth() === mesAtual && data.getFullYear() === anoAtual;
  });

  let totalOrcado = 0;
  let totalConcluido = 0;

  orcamentosMes.forEach((orcamento) => {
    const valor = parseNumero(orcamento.valor);
    totalOrcado += valor;
    if (orcamento.concluido === true) {
      totalConcluido += valor;
    }
  });

  const lucroEstimado = totalConcluido * 0.25;
  const percentualConversao = totalOrcado > 0 ? ((totalConcluido / totalOrcado) * 100).toFixed(1) : "0.0";

  if (getElement("totalOrcado")) getElement("totalOrcado").textContent = `R$ ${formatarMoeda(totalOrcado)}`;
  if (getElement("totalAprovado")) getElement("totalAprovado").textContent = `R$ ${formatarMoeda(totalConcluido)}`;
  if (getElement("lucroEstimado")) getElement("lucroEstimado").textContent = `R$ ${formatarMoeda(lucroEstimado)}`;
  if (getElement("percentualConversao")) getElement("percentualConversao").textContent = `${String(percentualConversao).replace(".", ",")}%`;
}

function exportarRelatorio(tipo) {
  const mes = new Date().toLocaleString("pt-BR", { month: "long" });
  const ano = new Date().getFullYear();
  const titulo = `Relatorio-Mensal-${mes.charAt(0).toUpperCase() + mes.slice(1)}-${ano}`;

  if (tipo === "pdf") {
    if (!window.jspdf?.jsPDF) {
      alert("A biblioteca jsPDF nao foi carregada.");
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(titulo, 20, 20);
    doc.setFontSize(11);
    doc.text(getElement("gestaoFinanceira")?.innerText || "Sem dados financeiros disponiveis.", 20, 35);
    doc.save(`${titulo}.pdf`);
    return;
  }

  if (tipo === "excel") {
    let conteudo = "Categoria\tValor\n";
    conteudo += `Total Orcado\t${getElement("totalOrcado")?.innerText || "R$ 0,00"}\n`;
    conteudo += `Total Aprovado\t${getElement("totalAprovado")?.innerText || "R$ 0,00"}\n`;
    conteudo += `Lucro Estimado\t${getElement("lucroEstimado")?.innerText || "R$ 0,00"}\n`;
    conteudo += `Conversao\t${getElement("percentualConversao")?.innerText || "0,0%"}\n`;

    const blob = new Blob([conteudo], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${titulo}.xls`;
    link.click();
    URL.revokeObjectURL(url);
  }
}

function updateProgressBar() {
  const progressBar = getElement("progressBar");
  if (!progressBar) return;

  const atualizar = () => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const porcentagem = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    progressBar.style.width = `${porcentagem}%`;
  };

  window.addEventListener("scroll", atualizar);
  atualizar();
}

function configurarSliderDesconto() {
  const slider = getElement("percentualDesconto");
  const label = getElement("valorDescontoLabel");
  if (!slider || !label) return;

  const atualizar = () => {
    label.textContent = `${slider.value}%`;
  };

  slider.addEventListener("input", atualizar);
  atualizar();
}

document.addEventListener("DOMContentLoaded", () => {
  alternarModoEdicao(false);
  configurarSliderDesconto();
  configurarModalHistorico();
  updateProgressBar();
  atualizarGestaoFinanceira();
  renderizarProdutosAdicionados();
});

window.adicionarProduto = adicionarProduto;
window.editarProduto = editarProduto;
window.removerProduto = removerProduto;
window.salvarEdicaoProduto = salvarEdicaoProduto;
window.limparCamposProduto = limparCamposProduto;
window.gerarPDF = gerarPDF;
window.exportarRelatorio = exportarRelatorio;


