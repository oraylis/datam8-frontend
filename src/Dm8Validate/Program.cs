using Dm8Data;
using Dm8Data.Validate;
using CommandLine;
using Dm8Validate;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using NJsonSchema.CodeGeneration.CSharp;
using NJsonSchema.Generation;
using NJsonSchema;
using Newtonsoft.Json.Schema;


class Program
{   
    #pragma warning disable CS8604 // Possible null reference argument.
    #pragma warning disable CS8602 // Dereference of a possibly null reference.
    static int Main(string[] args)
    {       
        using ILoggerFactory loggerFactory =
            LoggerFactory.Create(builder =>
                builder.AddSimpleConsole(options =>
                {
                    options.SingleLine = true;
                    options.UseUtcTimestamp = true;
                    options.IncludeScopes = false;
                    options.TimestampFormat = "HH:mm:ss";
                }));

        ILogger<Program> logger = loggerFactory.CreateLogger<Program>();
        var sendValidateOutput = new SendValidateOutput(logger);

        using (logger.BeginScope("[Dm8Validate]"))
        {
            var result = Parser.Default.ParseArguments<Options>(args)
                .WithParsed<Options>(o =>
                {
                    logger.LogInformation($"Validating Dm8 solution {o.Dm8SolutionFile}");
                    Solution? solution;
                    try
                    {
                        var solutionContent = File.ReadAllText(o.Dm8SolutionFile);
                        solution = JsonConvert.DeserializeObject<Dm8Data.Solution>(solutionContent);
                        solution.CurrentRootFolder = Path.GetDirectoryName(o.Dm8SolutionFile);
                    }
                    catch (Exception e)
                    {
                        logger.LogCritical(e, $"Error opening Dm8 solution {o.Dm8SolutionFile}");
                        throw;
                    }

                    var solutionHelper = new SolutionHelper(solution, sendValidateOutput);
                    var task = solutionHelper.CreateAndValidateAsync();
                    task.Wait();
                    logger.LogInformation($"Validated Dm8 solution {o.Dm8SolutionFile}");
                });
        }

        if (sendValidateOutput.HasSendError)
            return -1;

        return 0;
    }
}

