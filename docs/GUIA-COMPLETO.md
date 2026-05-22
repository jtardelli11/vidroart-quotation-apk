# VIDROART — Guia Completo: APK Android com Capacitor

> **Estratégia:** o APK é uma "casca" Android que abre o site do GitHub Pages.  
> Quando você atualiza o site, o app carrega a nova versão automaticamente — sem gerar um novo APK.

---

## Índice

1. [Pré-requisitos](#1-pré-requisitos)
2. [Estrutura de pastas do projeto](#2-estrutura-de-pastas)
3. [Instalação das dependências](#3-instalação-das-dependências)
4. [Inicializar o Capacitor](#4-inicializar-o-capacitor)
5. [Adicionar a plataforma Android](#5-adicionar-a-plataforma-android)
6. [Configurar arquivos Android](#6-configurar-arquivos-android)
7. [Melhorias mobile no site (GitHub Pages)](#7-melhorias-mobile-no-site-github-pages)
8. [Sincronizar e abrir no Android Studio](#8-sincronizar-e-abrir-no-android-studio)
9. [Gerar o APK](#9-gerar-o-apk)
10. [Instalar no celular](#10-instalar-no-celular)
11. [Fluxo de atualização (sem novo APK)](#11-fluxo-de-atualização)
12. [Limitações importantes](#12-limitações-importantes)
13. [Problemas comuns](#13-problemas-comuns)

---

## 1. Pré-requisitos

Instale tudo antes de começar:

| Ferramenta | Versão mínima | Download |
|---|---|---|
| **Node.js** | 18 LTS | https://nodejs.org |
| **Java JDK** | 17 | https://adoptium.net |
| **Android Studio** | Hedgehog+ | https://developer.android.com/studio |
| **Android SDK** | API 33+ | Instalar dentro do Android Studio |
| **Git** | qualquer | https://git-scm.com |

### Configurar variáveis de ambiente (Windows)

Adicione ao PATH do sistema:

```
C:\Users\SeuUsuario\AppData\Local\Android\Sdk\platform-tools
C:\Users\SeuUsuario\AppData\Local\Android\Sdk\tools
```

Crie a variável:
```
ANDROID_HOME = C:\Users\SeuUsuario\AppData\Local\Android\Sdk
```

### Configurar variáveis de ambiente (Linux/Mac)

Adicione ao `~/.bashrc` ou `~/.zshrc`:

```bash
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/tools
```

---

## 2. Estrutura de pastas

Crie a pasta do projeto e copie os arquivos fornecidos:

```
vidroart-android/
├── capacitor.config.ts       ← configuração principal
├── package.json              ← dependências
├── www/
│   └── index.html            ← tela de loading/offline (fallback)
└── android/                  ← gerado automaticamente pelo Capacitor
    └── app/
        └── src/main/
            ├── AndroidManifest.xml
            └── res/
                └── xml/
                    ├── network_security_config.xml
                    └── file_paths.xml
```

---

## 3. Instalação das dependências

Abra o terminal na pasta `vidroart-android/` e execute:

```bash
# Instalar dependências do projeto
npm install

# Verificar se o Capacitor CLI está disponível
npx cap --version
```

---

## 4. Inicializar o Capacitor

```bash
npx cap init "VIDROART Orçamentos" "com.vidroart.orcamentos" --web-dir www
```

Isso vai gerar o `capacitor.config.json`. **Substitua pelo `capacitor.config.ts`** fornecido neste projeto (já está configurado com a URL do GitHub Pages).

---

## 5. Adicionar a plataforma Android

```bash
npx cap add android
```

Esse comando cria a pasta `android/` com o projeto Android Studio.

---

## 6. Configurar arquivos Android

### 6.1 — network_security_config.xml

Copie o arquivo `android-resources/network_security_config.xml` para:

```
android/app/src/main/res/xml/network_security_config.xml
```

*Se a pasta `xml` não existir, crie-a.*

### 6.2 — file_paths.xml

Copie `android-resources/file_paths.xml` para:

```
android/app/src/main/res/xml/file_paths.xml
```

### 6.3 — AndroidManifest.xml

Abra `android/app/src/main/AndroidManifest.xml` e:

**a)** Adicione as permissões antes de `<application>`:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"
    android:maxSdkVersion="28"/>
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"
    android:maxSdkVersion="32"/>
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES"/>
```

**b)** Dentro da tag `<application>`, adicione:

```xml
android:networkSecurityConfig="@xml/network_security_config"
```

### 6.4 — build.gradle (versão do SDK)

Abra `android/app/build.gradle` e confirme:

```gradle
android {
    compileSdkVersion 34
    defaultConfig {
        applicationId "com.vidroart.orcamentos"
        minSdkVersion 24        // Android 7.0 (boa cobertura)
        targetSdkVersion 34
        versionCode 1
        versionName "1.0.0"
    }
}
```

### 6.5 — strings.xml (nome do app)

Abra `android/app/src/main/res/values/strings.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">VIDROART Orçamentos</string>
    <string name="title_activity_main">VIDROART Orçamentos</string>
    <string name="package_name">com.vidroart.orcamentos</string>
    <string name="custom_url_scheme">com.vidroart.orcamentos</string>
</resources>
```

---

## 7. Melhorias mobile no site (GitHub Pages)

Para que o site funcione melhor no celular, adicione o arquivo `mobile-improvements.css` ao seu repositório do GitHub Pages:

### Passo a passo:

**a)** Copie `android-resources/mobile-improvements.css` para a pasta `css/` do seu repositório GitHub.

**b)** No `index.html` do seu site, adicione dentro do `<head>`:

```html
<!-- Melhorias para mobile / APK Android -->
<link rel="stylesheet" href="css/mobile-improvements.css">
```

**c)** Verifique se o viewport já está correto (deve estar):

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
```

**d)** Faça commit e push:

```bash
git add css/mobile-improvements.css index.html
git commit -m "feat: melhorias mobile para APK Android"
git push origin main
```

---

## 8. Sincronizar e abrir no Android Studio

```bash
# Sincronizar arquivos www → Android
npx cap sync android

# Abrir o projeto no Android Studio
npx cap open android
```

---

## 9. Gerar o APK

### Opção A — Android Studio (recomendado)

1. No Android Studio, vá em **Build → Build Bundle(s) / APK(s) → Build APK(s)**
2. Aguarde o build
3. Clique em **"locate"** na notificação que aparece
4. O APK estará em: `android/app/build/outputs/apk/debug/app-debug.apk`

### Opção B — Linha de comando

```bash
cd android
./gradlew assembleDebug
```

O APK ficará em:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

### APK de produção (release)

Para gerar um APK assinado para distribuição:

```bash
cd android
./gradlew assembleRelease
```

Você precisará criar um keystore primeiro:

```bash
keytool -genkey -v -keystore vidroart.keystore -alias vidroart -keyalg RSA -keysize 2048 -validity 10000
```

---

## 10. Instalar no celular

### Via USB (debug)

1. Ative **Opções do desenvolvedor** no celular (toque 7x em "Número da versão" em Configurações)
2. Ative **Depuração USB**
3. Conecte o celular ao PC
4. Execute:

```bash
cd android
adb install app/build/outputs/apk/debug/app-debug.apk
```

### Via arquivo (qualquer Android)

1. Copie o `.apk` para o celular (WhatsApp, e-mail, USB)
2. No celular, ative **"Instalar apps de fontes desconhecidas"**
3. Abra o arquivo `.apk` e instale

---

## 11. Fluxo de atualização

Esta é a grande vantagem da estratégia de URL remota:

```
┌─────────────────────────────────────────────────────────┐
│  1. Edite os arquivos no VS Code (HTML, CSS, JS)        │
│  2. git add . && git commit -m "sua mensagem"           │
│  3. git push origin main                                │
│  4. GitHub Pages atualiza em ~1 minuto                  │
│  5. App instalado carrega a versão nova automaticamente │
│     (na próxima abertura com internet)                  │
└─────────────────────────────────────────────────────────┘
```

**Você NÃO precisa gerar um novo APK para atualizações de conteúdo.**

Só gere um novo APK quando mudar:
- Nome do app
- Permissões Android
- Plugins do Capacitor
- Ícone/splash screen

---

## 12. Limitações importantes

| Limitação | Impacto | Alternativa |
|---|---|---|
| **Requer internet** | Sem conexão = tela de offline | O app mostra mensagem amigável com botão "Tentar novamente" |
| **localStorage** | Dados salvos ficam no WebView do celular (não sincronizam com o desktop) | Usar o histórico normalmente no celular |
| **Geração de PDF** | jsPDF funciona no Android, mas "salvar" depende das permissões de armazenamento | Compartilhar via apps do celular |
| **Câmera / galeria** | `<input type="file">` funciona para galeria; câmera pode precisar de plugin extra | Atual já deve funcionar para seleção de foto |
| **Push Notifications** | Não disponível nesta configuração | Adicionar `@capacitor/push-notifications` se necessário |
| **App Store** | APK de debug não pode ser publicado na Play Store | Gerar release assinado para publicar |

---

## 13. Problemas comuns

### ❌ "net::ERR_CLEARTEXT_NOT_PERMITTED"
**Causa:** URL HTTP em vez de HTTPS  
**Solução:** Use sempre HTTPS. GitHub Pages já usa HTTPS por padrão ✓

### ❌ Tela branca ao abrir
**Causa:** A URL do GitHub Pages não está acessível ou demorou para carregar  
**Solução:** A tela de loading/offline (`www/index.html`) cuida disso

### ❌ Zoom indesejado ao clicar em input
**Causa:** `font-size` menor que 16px nos inputs  
**Solução:** O `mobile-improvements.css` corrige isso com `font-size: 16px !important`

### ❌ Build falhou — "SDK not found"
**Solução:**
```bash
# Crie o arquivo local.properties na pasta android/
echo "sdk.dir=/Users/SeuUsuario/Library/Android/sdk" > android/local.properties
# No Windows:
echo sdk.dir=C:\\Users\\SeuUsuario\\AppData\\Local\\Android\\Sdk > android\local.properties
```

### ❌ "capacitor.config.ts not found"
**Solução:** Compile o TypeScript primeiro:
```bash
npx tsc capacitor.config.ts --outDir .
```
Ou renomeie para `capacitor.config.json` e adapte a sintaxe.

### ❌ App fecha ao voltar (botão back)
**Causa:** Comportamento padrão do WebView  
**Solução:** Adicionar plugin `@capacitor/app` para controlar o botão back:
```bash
npm install @capacitor/app
npx cap sync android
```

---

## Resumo dos comandos

```bash
# 1. Instalar dependências
npm install

# 2. Inicializar (já feito se usar os arquivos deste projeto)
npx cap init "VIDROART Orçamentos" "com.vidroart.orcamentos" --web-dir www

# 3. Adicionar Android
npx cap add android

# 4. Sincronizar
npx cap sync android

# 5. Abrir Android Studio
npx cap open android

# 6. Gerar APK debug (dentro da pasta android/)
./gradlew assembleDebug

# 7. Instalar via ADB
adb install app/build/outputs/apk/debug/app-debug.apk
```

---

*Desenvolvido para VIDROART — Sistema de Orçamentos*  
*Capacitor v6 · Android SDK 34 · minSdk 24*
 
