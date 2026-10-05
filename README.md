# GameStore Studio

Aplicativo Android para cadastrar, vender e distribuir os seus próprios jogos. O catálogo, a biblioteca e o painel administrativo ficam no aplicativo. Pagamentos, arquivos dos jogos e permissões ficam no servidor.

O projeto é independente do jogo Unity que está na pasta ao lado. Nada daquele projeto foi apagado.

## O que o aplicativo faz

- Mostra jogos publicados, com capa, capturas, trailer, descrição, requisitos, preço e avaliações.
- Cria conta com e-mail e senha, entra com Google e recupera a senha.
- Mantém carrinho, cupom, checkout e histórico de compras.
- Confirma o pagamento só depois do webhook da Stripe. O retorno do navegador não marca o pedido como pago.
- Libera o download por um link temporário para quem comprou.
- Publica versões novas. Quem já comprou baixa a versão mais recente da plataforma.
- Restringe o painel a contas com papel `admin`.
- Oferece telas de privacidade, termos e exclusão de conta.

PIX é oferecido no checkout quando o preço está em BRL. A Stripe só conclui o PIX se a sua conta Stripe estiver habilitada para esse método no Brasil.

## Tecnologias

- Expo SDK 57, React Native 0.86 e TypeScript
- React Native Paper (Material Design 3), tema claro e escuro
- Supabase: PostgreSQL, Auth, Storage, Row Level Security e Edge Functions
- Stripe Checkout, com a chave secreta apenas nas Edge Functions

## 1. Instalar dependências

Na pasta `gamestore-studio`:

```bash
npm install
```

## 2. Configurar Node.js

Use Node.js 22.13 ou mais novo. Esta máquina de desenvolvimento foi verificada com Node.js 24.

```bash
node -v
npm -v
```

## 3. Configurar Android Studio

1. Instale o Android Studio.
2. No SDK Manager, instale Android SDK 36, Build-Tools e o Android SDK Command-line Tools.
3. Confirme as variáveis:

```bash
echo "$ANDROID_HOME"
```

O valor esperado é o diretório do SDK, por exemplo `$HOME/Android/Sdk`. O Java usado pelo build precisa ser um JDK completo 17 ou 21, com o executável `jlink`. O JBR do Android Studio nem sempre inclui o `jlink`. Nesta máquina, o build de release usou o Temurin 21 em `~/.local/jdks/jdk-21.0.12.1+1`:

```bash
export JAVA_HOME="$HOME/.local/jdks/jdk-21.0.12.1+1"
export PATH="$JAVA_HOME/bin:$PATH"
```

## 4. Configurar Supabase

1. Crie um projeto em https://supabase.com.
2. Em Project Settings → API, copie a URL do projeto e a chave `anon` `public`.
3. Instale a CLI, se for usá-la: https://supabase.com/docs/guides/cli
4. Na Authentication → Providers, mantenha E-mail ativo.
5. Para Google, ative o provider Google e cadastre o redirect `gamestorestudio://auth/callback`.
6. Em Authentication → URL Configuration, adicione o mesmo esquema às Redirect URLs.

## 5. Criar banco de dados

No SQL Editor do Supabase, execute o arquivo inteiro:

`supabase/migrations/20261003180000_init.sql`

Ele cria as tabelas, os índices, as constraints, as funções e as políticas RLS. Também cria os buckets `game-media` (público, só capas e trailers) e `game-files` (privado).

Não execute `supabase/seed/dev_only.sql` em produção. Esse arquivo cria apenas um rascunho interno chamado `[DEV] Pacote de teste interno` e recusa rodar se `gamestore.environment` for `production`.

Pela CLI, na pasta do projeto:

```bash
supabase link --project-ref SEU_PROJECT_REF
supabase db push
```

## 6. Configurar variáveis de ambiente

```bash
cp .env.example .env
```

Preencha no `.env` apenas valores públicos usados pelo aplicativo:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anon
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
EXPO_PUBLIC_PRIVACY_CONTACT_EMAIL=seu-email@dominio
```

Não crie um `.env` com chaves reais dentro do Git. O arquivo `.env` está ignorado.

`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` e `SUPABASE_SERVICE_ROLE_KEY` não entram no aplicativo. Elas ficam nos segredos do Supabase, no passo 8.

## 7. Configurar Stripe

1. Crie uma conta em https://dashboard.stripe.com.
2. Em modo de teste, copie a chave publicável (`pk_test_`) para `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
3. Copie a chave secreta (`sk_test_`). Ela será usada só no servidor.
4. Para PIX, a conta Stripe precisa estar no Brasil e com PIX habilitado. O checkout pede PIX apenas para pedidos em BRL.
5. Não coloque a chave secreta em nenhum arquivo de `src/`.

## 8. Configurar webhooks

Publique as funções:

```bash
supabase secrets set \
  STRIPE_SECRET_KEY=sk_test_sua_chave \
  STRIPE_WEBHOOK_SECRET=whsec_sua_chave \
  APP_SCHEME=gamestorestudio

supabase functions deploy create-checkout
supabase functions deploy stripe-webhook --no-verify-jwt
supabase functions deploy create-download-url
supabase functions deploy delete-account
```

O Supabase já injeta `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` nas funções. Não copie a service role para o aplicativo.

No Stripe, crie um endpoint de webhook apontando para:

`https://SEU-PROJETO.supabase.co/functions/v1/stripe-webhook`

Eventos:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`

Para testar na sua máquina:

```bash
stripe listen --forward-to https://SEU-PROJETO.supabase.co/functions/v1/stripe-webhook
```

Use o `whsec_` mostrado por esse comando como `STRIPE_WEBHOOK_SECRET`.

## 9. Criar usuário administrador

1. Abra o aplicativo e crie uma conta com o seu e-mail.
2. No SQL Editor, promova somente essa conta:

```sql
update public.profiles
set role = 'admin'
where email = 'seu-email@dominio';
```

Não existe promoção automática. Um usuário comum não passa nas políticas RLS nem no bloqueio da tela administrativa. O último administrador não pode ser rebaixado pelo painel.

## 10. Executar o aplicativo localmente

```bash
npm start
```

Para abrir direto no Android já compilado nesta máquina:

```bash
npm run android
```

No Expo Go, recursos nativos de vídeo, arquivos e login podem exigir um development build. Para a Google Play, use o AAB de release, não o Expo Go.

## 11. Testar pagamentos

1. Entre com uma conta que não seja necessária para administrar a loja.
2. Publique um jogo de teste com preço baixo, em BRL se quiser exercitar o PIX.
3. Compre pelo checkout. Use um cartão de teste da Stripe, por exemplo `4242 4242 4242 4242`.
4. Confirme no Stripe que o webhook retornou sucesso.
5. Abra a biblioteca. O jogo só deve aparecer com o pedido `paid`.
6. Toque em Baixar. O arquivo chega por uma URL assinada que expira em 120 segundos.
7. Publique a versão seguinte do mesmo jogo. A biblioteca deve mostrar a versão nova para quem já comprou.

O aplicativo não tem botão para simular pagamento. Sem webhook configurado, o pedido permanece pendente.

## 12. Gerar APK de teste

Gere a keystore uma única vez e guarde a pasta `signing/` fora do Git:

```bash
mkdir -p signing
export GAMESTORE_STORE_PASSWORD="$(openssl rand -base64 24)"
keytool -genkeypair -v \
  -storetype PKCS12 \
  -keystore signing/gamestore-upload.jks \
  -alias gamestore-upload \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass "$GAMESTORE_STORE_PASSWORD" \
  -keypass "$GAMESTORE_STORE_PASSWORD" \
  -dname "CN=GameStore Studio, O=GameStore Studio, C=BR"
printf 'storePassword=%s\nkeyPassword=%s\nkeyAlias=gamestore-upload\nstoreFile=gamestore-upload.jks\n' \
  "$GAMESTORE_STORE_PASSWORD" "$GAMESTORE_STORE_PASSWORD" > signing/keystore.properties
```

Depois:

```bash
npm run android:prebuild
npm run android:apk
```

O APK fica em:

`android/app/build/outputs/apk/release/app-release.apk`

## 13. Gerar AAB de produção

```bash
npm run android:aab
```

O AAB fica em:

`android/app/build/outputs/bundle/release/app-release.aab`

O build local desta máquina gerou também `release/gamestore-studio-1.0.0.aab` e `release/gamestore-studio-1.0.0.apk`. Eles incluem as arquiteturas `arm64-v8a` e `armeabi-v7a`, que cobrem celulares. Em um computador com mais memória, `android/gradle.properties` pode voltar a incluir `x86` e `x86_64` se você quiser emulador ou Chromebook. Um `expo prebuild --clean` recria a pasta `android`; rode o prebuild de novo para reaplicar a assinatura.

Uma cópia pode ser guardada em `release/`. Esses arquivos não devem ir para o Git.

## 14. Assinar o aplicativo

O plugin `plugins/withAndroidReleaseSigning.js` aplica a keystore de `signing/` durante o prebuild. Sem essa pasta, o release não fica assinado para a Play Store.

Faça backup de:

- `signing/gamestore-upload.jks`
- `signing/keystore.properties`

Perder a keystore impede atualizar o mesmo aplicativo na Google Play. A senha não fica no README de propósito.

Antes de cada versão nova, aumente em `app.config.ts`:

- `version`, por exemplo `1.1.0`
- `android.versionCode`, sempre um inteiro maior que o anterior

Rode o prebuild de novo se mudar ícone, permissões ou versão nativa.

## 15. Criar o aplicativo no Google Play Console

Não publique por esta automação. O envio é manual.

1. Acesse https://play.google.com/console.
2. Crie um app com o nome **GameStore Studio**.
3. O ID do aplicativo é `app.gamestorestudio.mobile`. Ele precisa ser o mesmo do AAB e não pode ser trocado depois.
4. Escolha o tipo de acesso da sua conta de desenvolvedor e aceite os termos da Play.

## 16. Preencher a ficha da loja

Prepare:

- Ícone 512×512, gerado em `assets/images/icon.png`
- Capturas de tela do telefone
- Descrição curta e descrição completa, dizendo que a loja vende os jogos do próprio desenvolvedor
- Categoria e classificação etária do questionário de conteúdo
- E-mail de contato
- URL pública da política de privacidade

Hospede `docs/privacy-policy.md` em um site seu. A Play não aceita só a tela interna. Ajuste o e-mail de contato nesse texto e em `EXPO_PUBLIC_PRIVACY_CONTACT_EMAIL`.

Na segurança dos dados, declare:

- nome e e-mail da conta
- histórico de compras
- pagamento processado pela Stripe
- dados não vendidos a terceiros
- exclusão de conta disponível no aplicativo

## 17. Enviar o AAB

Em Produção, ou primeiro em Teste interno, envie:

`android/app/build/outputs/bundle/release/app-release.aab`

O Play App Signing pode pedir que a Google gerencie a chave de assinatura do app. A keystore local continua sendo a chave de upload. Guarde-a mesmo assim.

## 18. Fazer testes internos

1. Crie uma faixa de teste interno.
2. Adicione os e-mails testadores.
3. Instale pelo link da Play, não por um APK paralelo, quando quiser validar a ficha.
4. Teste cadastro, login, catálogo, compra em modo de teste, biblioteca, download e painel administrativo.

## 19. Corrigir problemas encontrados

```bash
npm test
npm run typecheck
```

Corrija o código, aumente `versionCode`, gere outro AAB e envie uma nova versão na mesma faixa. Não reutilize um `versionCode` já enviado.

## 20. Publicar a versão de produção

1. Confira a política de privacidade publicada e a tela de exclusão de conta.
2. Troque as chaves da Stripe de teste pelas chaves de produção e atualize o webhook de produção.
3. Promova a versão da faixa de teste para produção, ou envie o AAB direto na faixa de produção.
4. Envie para revisão da Google. A publicação só ocorre depois da sua confirmação no Play Console e da aprovação da Google.

## Comandos úteis

```bash
npm start
npm test
npm run typecheck
npm run android:prebuild
npm run android:apk
npm run android:aab
```

## Segurança já aplicada

- RLS em todas as tabelas da loja.
- Papéis `user` e `admin`. O usuário não consegue alterar o próprio papel.
- Pedidos e pagamentos só são criados por funções de servidor.
- O caminho privado do arquivo não é concedido ao aplicativo. O download usa URL assinada.
- Somente o administrador envia arquivos para os buckets.
- O webhook confere a assinatura e o valor antes de marcar o pedido como pago.
- A chave de idempotência impede o mesmo pedido duas vezes.
- Ações de pedido, versão e download geram `audit_logs`.

## O que continua manual

- Criar o projeto Supabase, rodar a migration e promover o administrador.
- Criar a conta Stripe, gravar os segredos e cadastrar o webhook.
- Habilitar PIX na Stripe, se for usar esse método.
- Criar o app no Google Play Console, preencher a ficha, enviar o AAB e publicar.
