using Microsoft.EntityFrameworkCore;
using MySqlConnector;

namespace Backend.Data;

public static class DbUpdateExceptionExtensions
{
    // Dois pedidos simultâneos podem passar pela checagem de duplicidade feita antes do insert;
    // o índice único barra o segundo com este erro.
    public static bool IsUniqueViolation(this DbUpdateException ex) =>
        ex.InnerException is MySqlException { ErrorCode: MySqlErrorCode.DuplicateKeyEntry };

    // O InnoDB desfez esta transação para destravar outra que esperava por ela; repetir resolve.
    public static bool IsDeadlock(this DbUpdateException ex) =>
        ex.InnerException is MySqlException { ErrorCode: MySqlErrorCode.LockDeadlock };
}
