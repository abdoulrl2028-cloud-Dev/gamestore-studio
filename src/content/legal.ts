import { env } from '@/config/env';

const contact = env.privacyContact || 'Configure EXPO_PUBLIC_PRIVACY_CONTACT_EMAIL antes de publicar.';

export const privacyPolicy = `Política de privacidade — GameStore Studio

Esta política descreve como o aplicativo GameStore Studio trata dados da sua conta, das compras e dos downloads. Ela se aplica ao aplicativo Android publicado pelo proprietário da loja.

1. Dados que coletamos
- Nome de exibição e e-mail da conta.
- Histórico de pedidos, status de pagamento e jogos adquiridos.
- Avaliações que você publica.
- Registro de downloads concedidos, sem tornar o arquivo do jogo público.
- Dados técnicos mínimos enviados pelo sistema para autenticação e segurança.

2. Pagamentos
Os pagamentos são processados pela Stripe. O aplicativo não recebe nem armazena número de cartão, senha bancária ou chave PIX. A confirmação da compra chega por webhook validado no servidor.

3. Login com Google
Se você usar o Google, recebemos o identificador e o e-mail autorizados por esse provedor, por meio do Supabase Auth.

4. Para que usamos os dados
- Criar e proteger sua conta.
- Exibir o catálogo e a biblioteca dos jogos comprados.
- Liberar o download somente após o pagamento confirmado.
- Atender pedidos de suporte, exclusão de conta e obrigações fiscais do vendedor.

5. Compartilhamento
Os dados de conta ficam no Supabase. Os dados de pagamento ficam na Stripe. Não vendemos listas de clientes.

6. Retenção
Pedidos pagos podem permanecer sem o vínculo da conta, apenas como registro da venda, quando a exclusão da conta for solicitada. Avaliações e a sessão são removidas junto com a conta.

7. Exclusão
Você pode excluir a conta na tela "Exclusão de conta". Essa ação pede a confirmação EXCLUIR e é executada no servidor.

8. Contato
${contact}`;

export const termsOfUse = `Termos de uso — GameStore Studio

1. A loja
O GameStore Studio é a vitrine do proprietário para vender e distribuir os próprios jogos. O catálogo mostra somente jogos publicados por esse administrador.

2. Conta
Você é responsável pela senha e pelo uso da conta. O cadastro exige um e-mail válido.

3. Compras
O preço cobrado é o preço gravado no servidor no momento do pedido. Um cupom só vale se o servidor o aceitar. A compra entra na biblioteca quando o pagamento é confirmado pelo backend. O retorno do navegador, sozinho, não conclui a compra.

4. Downloads
Os arquivos ficam em armazenamento privado. O link de download é temporário e só é emitido para quem comprou o jogo. Você pode baixar a versão mais recente publicada para a plataforma adquirida.

5. Licença
A compra concede uma licença de uso pessoal do jogo, segundo as condições definidas pelo proprietário na página do produto. Ela não transfere a propriedade intelectual do jogo.

6. Conduta
É proibido tentar acessar o painel administrativo, os arquivos privados ou o pagamento sem autorização, e também publicar avaliações falsas ou ofensivas.

7. Conta e encerramento
Você pode excluir a própria conta. O proprietário pode despublicar um jogo ou encerrar contas que abusem do serviço, mantendo os registros de venda exigidos.

8. Contato
${contact}`;
