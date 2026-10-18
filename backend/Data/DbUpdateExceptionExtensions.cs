using Microsoft.EntityFrameworkCore;
using MySqlConnector;

namespace Kliny.Api.Data;

public static class DbUpdateExceptionExtensions
{
    // Dois pedidos simultâneos podem passar pela checagem feita antes do insert: o índice barra o segundo.
    public static bool IsUniqueViolation(this DbUpdateException ex) =>
        ex.InnerException is MySqlException { ErrorCode: MySqlErrorCode.DuplicateKeyEntry };

    // O InnoDB desfez esta transação para destravar outra; repetir resolve.
    public static bool IsDeadlock(this DbUpdateException ex) =>
        ex.InnerException is MySqlException { ErrorCode: MySqlErrorCode.LockDeadlock };
}
