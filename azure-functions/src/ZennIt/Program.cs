using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using ZennIt;

var host = new HostBuilder()
    .ConfigureFunctionsWebApplication(workerApplication =>
    {
        workerApplication.UseMiddleware<CorsMiddleware>();
    })
    .ConfigureServices(services =>
    {
        services.AddHttpClient();
        services.AddCors(options =>
        {
            options.AddPolicy("AllowSpecificOrigin",
                builder => builder
                    .WithOrigins("chrome-extension://mlhbhgjbdbgealohaocdehgkopefkndd")
                    .AllowAnyMethod()
                    .AllowAnyHeader()
                    .AllowCredentials());
        });
    })
    .Build();

await host.RunAsync();