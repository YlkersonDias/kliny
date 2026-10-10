using Backend.Localization;

namespace Backend.Resources;

// Mensagens da API em português e inglês, lado a lado: Text(português, inglês).
// O idioma vem do Accept-Language (RequestLocalization no Program.cs); o padrão é o português.
// Não usa .resx: o idioma extra viraria um assembly satélite (en-US\Backend.resources.dll), e
// políticas como o Smart App Control do Windows bloqueiam esse DLL em silêncio, deixando tudo em português.
// Os DTOs usam estas propriedades em ErrorMessageResourceType/ErrorMessageResourceName.
public static class Messages
{
    private static string Text(string portuguese, string english) =>
        AppCultures.IsEnglish ? english : portuguese;

    // Mensagens com {0} e {1}: usar com string.Format.

    public static string EmailInUse => Text(
        "Este e-mail já está cadastrado.",
        "This email is already registered.");

    public static string InvalidCredentials => Text(
        "E-mail ou senha inválidos.",
        "Invalid email or password.");

    public static string TooManyAttemptsOneMinute => Text(
        "Muitas tentativas. Tente novamente em 1 minuto.",
        "Too many attempts. Try again in 1 minute.");

    public static string TooManyAttemptsMinutes => Text(
        "Muitas tentativas. Tente novamente em {0} minutos.",
        "Too many attempts. Try again in {0} minutes.");

    public static string NameRequired => Text(
        "Informe o nome.",
        "Enter your name.");

    public static string NameMaxLength => Text(
        "O nome deve ter no máximo 100 caracteres.",
        "The name must be at most 100 characters.");

    public static string EmailRequired => Text(
        "Informe o e-mail.",
        "Enter your email.");

    public static string EmailInvalid => Text(
        "E-mail inválido.",
        "Invalid email.");

    public static string EmailMaxLength => Text(
        "O e-mail deve ter no máximo 255 caracteres.",
        "The email must be at most 255 characters.");

    public static string PasswordRequired => Text(
        "Informe a senha.",
        "Enter your password.");

    public static string PasswordLength => Text(
        "A senha deve ter entre 8 e 72 caracteres.",
        "The password must be between 8 and 72 characters.");

    public static string PasswordTooLong => Text(
        "A senha é longa demais: com acentos ou emojis, o limite de 72 caracteres fica menor.",
        "The password is too long: with accents or emojis, the 72-character limit gets shorter.");

    public static string GoogleSignInFailed => Text(
        "Não foi possível entrar com esta conta do Google. Use uma conta Gmail ou do Google Workspace, ou entre com e-mail e senha.",
        "Could not sign in with this Google account. Use a Gmail or Google Workspace account, or sign in with email and password.");

    public static string GoogleCredentialRequired => Text(
        "Comprovante do Google ausente ou inválido.",
        "Missing or invalid Google credential.");

    public static string GoogleLinkFailed => Text(
        "Não foi possível confirmar a conta do Google. Tente de novo.",
        "Could not confirm the Google account. Try again.");

    public static string GoogleAlreadyLinked => Text(
        "Esta conta do Google já está vinculada a outra conta do Kliny.",
        "This Google account is already linked to another Kliny account.");

    public static string GoogleLinkedToAnother => Text(
        "Sua conta já tem outra conta do Google vinculada. Desvincule-a antes.",
        "Your account already has another Google account linked. Unlink it first.");

    public static string GoogleUnlinkNeedsPassword => Text(
        "Esta conta não tem senha: sem o Google, não haveria como entrar. Por isso o Google não pode ser desvinculado.",
        "This account has no password: without Google there would be no way to sign in, so Google cannot be unlinked.");

    public static string GoogleReauthFailed => Text(
        "Entre com a mesma conta do Google vinculada a esta conta para confirmar.",
        "Sign in with the same Google account linked to this account to confirm.");

    public static string WrongPassword => Text(
        "Senha incorreta.",
        "Incorrect password.");

    public static string CategoryNotFound => Text(
        "Categoria não encontrada.",
        "Category not found.");

    public static string CategoryDuplicateName => Text(
        "Já existe uma categoria com esse nome.",
        "A category with this name already exists.");

    public static string CategoryNameRequired => Text(
        "Informe o nome da categoria.",
        "Enter the category name.");

    public static string CategoryNameMaxLength => Text(
        "O nome da categoria deve ter no máximo 100 caracteres.",
        "The category name must be at most 100 characters.");

    public static string TransactionNotFound => Text(
        "Movimentação não encontrada.",
        "Transaction not found.");

    public static string VaultTransactionReadOnly => Text(
        "Movimentações de cofre só podem ser alteradas pelas operações do cofre.",
        "Vault transactions can only be changed through the vault's operations.");

    public static string DescriptionRequired => Text(
        "Informe a descrição.",
        "Enter a description.");

    public static string DescriptionMaxLength => Text(
        "A descrição deve ter no máximo 255 caracteres.",
        "The description must be at most 255 characters.");

    public static string AmountRequired => Text(
        "Informe o valor.",
        "Enter the amount.");

    public static string DateRequired => Text(
        "Informe a data.",
        "Enter the date.");

    public static string AmountZero => Text(
        "O valor não pode ser zero.",
        "The amount cannot be zero.");

    public static string AmountMustBePositive => Text(
        "O valor deve ser maior que zero.",
        "The amount must be greater than zero.");

    public static string AmountTooManyDecimals => Text(
        "O valor deve ter no máximo duas casas decimais.",
        "The amount must have at most two decimal places.");

    public static string AmountTooLarge => Text(
        "O valor é grande demais.",
        "The amount is too large.");

    public static string FromAfterTo => Text(
        "A data inicial não pode ser depois da data final.",
        "The start date cannot be after the end date.");

    public static string SearchTooLong => Text(
        "A busca deve ter no máximo 100 caracteres.",
        "Search must be at most 100 characters.");

    public static string SortInvalid => Text(
        "Ordem inválida.",
        "Invalid sort order.");

    public static string CategoryAndUncategorized => Text(
        "Escolha uma categoria ou \"sem categoria\", não os dois.",
        "Choose a category or \"uncategorized\", not both.");

    public static string VaultOperationsHaveNoCategory => Text(
        "Operações de cofre não têm categoria.",
        "Vault operations have no category.");

    public static string PageRange => Text(
        "A página deve ficar entre 1 e 1.000.000.",
        "The page must be between 1 and 1,000,000.");

    public static string PageSizeRange => Text(
        "O tamanho da página deve ficar entre 1 e 100.",
        "The page size must be between 1 and 100.");

    public static string VaultNotFound => Text(
        "Cofre não encontrado.",
        "Vault not found.");

    public static string VaultDuplicateName => Text(
        "Já existe um cofre com esse nome.",
        "A vault with this name already exists.");

    public static string VaultNameRequired => Text(
        "Informe o nome do cofre.",
        "Enter the vault name.");

    public static string VaultNameMaxLength => Text(
        "O nome do cofre deve ter no máximo 100 caracteres.",
        "The vault name must be at most 100 characters.");

    public static string VaultHasBalance => Text(
        "Retire o saldo antes de apagar o cofre.",
        "Withdraw the balance before deleting the vault.");

    public static string BudgetMustBePositive => Text(
        "O limite deve ser maior que zero.",
        "The limit must be greater than zero.");

    public static string BudgetNotFound => Text(
        "Orçamento não encontrado.",
        "Budget not found.");

    public static string MonthInvalid => Text(
        "Informe o mês no formato AAAA-MM.",
        "Enter the month as YYYY-MM.");

    public static string RecurrenceNotFound => Text(
        "Lançamento recorrente não encontrado.",
        "Recurring entry not found.");

    public static string RecurrenceEndBeforeStart => Text(
        "A data final deve ser igual ou posterior à primeira.",
        "The end date must be on or after the first date.");

    public static string RecurrenceStartOutOfRange => Text(
        "A primeira data deve estar a no máximo um ano de hoje.",
        "The first date must be within one year of today.");

    public static string RecurrenceLimitReached => Text(
        "Você chegou ao limite de {0} lançamentos recorrentes.",
        "You have reached the limit of {0} recurring entries.");

    public static string TodayInvalid => Text(
        "A data de hoje não confere com a do servidor. Confira o relógio do aparelho.",
        "Today's date does not match the server's. Check your device's clock.");

    public static string InstallmentNotFound => Text(
        "Compra parcelada não encontrada.",
        "Installment purchase not found.");

    public static string InstallmentDescriptionMaxLength => Text(
        "A descrição deve ter no máximo 245 caracteres.",
        "The description must be at most 245 characters.");

    public static string InstallmentCountRange => Text(
        "Informe de 2 a 120 parcelas.",
        "Enter 2 to 120 installments.");

    public static string InstallmentTotalPositive => Text(
        "O valor total deve ser maior que zero.",
        "The total must be greater than zero.");

    public static string InstallmentTotalTooSmall => Text(
        "O valor total precisa dar pelo menos R$ 0,01 por parcela.",
        "The total must be at least R$0.01 per installment.");

    public static string InstallmentLimitReached => Text(
        "Você chegou ao limite de {0} compras parceladas.",
        "You have reached the limit of {0} installment purchases.");

    public static string InstallmentScopeInvalid => Text(
        "Escolha apagar todas as parcelas ou só as futuras.",
        "Choose to delete all installments or only the future ones.");

    public static string CategoryRulePatternRequired => Text(
        "Informe o texto que a descrição deve conter.",
        "Enter the text the description must contain.");

    public static string CategoryRulePatternMaxLength => Text(
        "O texto deve ter no máximo 100 caracteres.",
        "The text must be at most 100 characters.");

    public static string CategoryRuleCategoryRequired => Text(
        "Escolha a categoria.",
        "Choose the category.");

    public static string CategoryRuleNotFound => Text(
        "Regra não encontrada.",
        "Rule not found.");

    public static string CategoryRulePatternInUse => Text(
        "Já existe uma regra com esse texto.",
        "There is already a rule with this text.");

    public static string CategoryRuleLimitReached => Text(
        "Você chegou ao limite de {0} regras.",
        "You have reached the limit of {0} rules.");

    public static string ImportLinesRequired => Text(
        "Escolha ao menos uma movimentação para importar.",
        "Choose at least one transaction to import.");

    public static string ImportTooManyLines => Text(
        "No máximo {0} movimentações por importação. Exporte um período menor.",
        "At most {0} transactions per import. Export a shorter period.");

    public static string ImportLineInvalid => Text(
        "Uma linha do extrato está num formato inválido.",
        "A statement line is in an invalid format.");

    public static string ImportDateOutOfRange => Text(
        "A data deve ser de 2000 em diante e até um ano depois de hoje.",
        "The date must be from 2000 onwards and up to one year from today.");

    public static string ImportDuplicateLine => Text(
        "A mesma linha do extrato aparece duas vezes.",
        "The same statement line appears twice.");

    public static string GoalMustBePositive => Text(
        "A meta deve ser maior que zero.",
        "The goal must be greater than zero.");

    public static string VaultOperationFutureDate => Text(
        "Operações de cofre não podem ter data futura.",
        "Vault operations cannot have a future date.");

    public static string VaultInsufficientBalance => Text(
        "Saldo insuficiente no cofre. Disponível: {0}.",
        "Insufficient vault balance. Available: {0}.");

    public static string AccountInsufficientBalance => Text(
        "Saldo insuficiente na conta. Disponível em {0}: {1}.",
        "Insufficient account balance. Available on {0}: {1}.");

    public static string AddIncomeBeforeDeposit => Text(
        "Lance uma receita antes de depositar.",
        "Add income before depositing.");

    public static string DepositDescription => Text(
        "Depósito no cofre {0}",
        "Deposit to vault {0}");

    public static string WithdrawalDescription => Text(
        "Retirada do cofre {0}",
        "Withdrawal from vault {0}");

    public static string IdempotencyKeyRequired => Text(
        "Envie o cabeçalho Idempotency-Key: depósitos e retiradas precisam dele para não serem gravados duas vezes.",
        "Send the Idempotency-Key header: deposits and withdrawals need it so they are not recorded twice.");

    public static string IdempotencyKeyInvalid => Text(
        "Chave de idempotência inválida: use de 1 a 64 letras, números, hífens ou sublinhados.",
        "Invalid idempotency key: use 1 to 64 letters, digits, hyphens or underscores.");

    public static string IdempotencyKeyReused => Text(
        "Esta chave de idempotência já foi usada numa operação diferente.",
        "This idempotency key was already used for a different operation.");

    public static string FromRequired => Text(
        "Informe a data inicial.",
        "Enter the start date.");

    public static string ToRequired => Text(
        "Informe a data final.",
        "Enter the end date.");

    public static string PeriodMaxYears => Text(
        "O período deve ter no máximo {0} anos.",
        "The period must be at most {0} years.");

    public static string TimelineDayMaxDays => Text(
        "Com agrupamento por dia, o período deve ter no máximo {0} dias.",
        "When grouping by day, the period must be at most {0} days.");
}
