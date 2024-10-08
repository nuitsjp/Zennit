using Microsoft.AspNetCore.Http.Features;
using Microsoft.Azure.Functions.Worker.Middleware;
using Microsoft.Azure.Functions.Worker;

namespace ZennIt;

public class CorsMiddleware : IFunctionsWorkerMiddleware
{
    public async Task Invoke(FunctionContext context, FunctionExecutionDelegate next)
    {
        context.Features.Set<IHttpResponseFeature>(new HttpResponseFeature
        {
            Headers =
            {
                AccessControlAllowOrigin = Environment.GetEnvironmentVariable("AccessControlAllowOrigin"),
                AccessControlAllowMethods = "GET, POST, OPTIONS",
                AccessControlAllowHeaders = "*",
                AccessControlAllowCredentials = "true"
            }
        });

        await next(context);
    }
}