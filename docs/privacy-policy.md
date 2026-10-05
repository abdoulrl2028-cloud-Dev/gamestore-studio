# Política de privacidade — GameStore Studio

Esta é a versão para hospedar em um endereço público exigido pelo Google Play. O mesmo texto aparece no aplicativo.

O GameStore Studio trata dados da conta, das compras e dos downloads do proprietário da loja.

## Dados coletados

- Nome de exibição e e-mail da conta.
- Histórico de pedidos, status de pagamento e jogos adquiridos.
- Avaliações publicadas pelo usuário.
- Registro de que um download temporário foi concedido.
- Dados técnicos mínimos de autenticação.

## Pagamentos

Os pagamentos são processados pela Stripe. O aplicativo não recebe número de cartão, senha bancária ou chave PIX. A compra só entra na biblioteca depois que o servidor valida o webhook.

## Login com Google

Se o usuário escolher o Google, o aplicativo recebe o identificador e o e-mail autorizados por esse provedor, por meio do Supabase Auth.

## Uso e compartilhamento

Os dados servem para autenticar, vender, liberar download e atender exclusão de conta. A conta fica no Supabase e o pagamento na Stripe. A loja não vende listas de clientes.

## Exclusão

O usuário pode excluir a conta na tela "Exclusão de conta". Pedidos pagos podem permanecer sem o e-mail, como registro da venda.

## Contato

Substitua este parágrafo pelo e-mail definido em `EXPO_PUBLIC_PRIVACY_CONTACT_EMAIL` antes de enviar o aplicativo ao Google Play.
