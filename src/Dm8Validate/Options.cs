using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using CommandLine;

namespace Dm8Validate;

public class Options
{
    [Option('f', "fileName",
        HelpText = "Full path of the Dm8-Solution file to validate",
        Required = true)]
    public string? Dm8SolutionFile { get; set; }
}