/* DataM8
 * Copyright (C) 2024-2025 ORAYLIS GmbH
 *
 * This file is part of DataM8.
 *
 * DataM8 is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * DataM8 is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

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

