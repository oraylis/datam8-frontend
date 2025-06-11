<img src="https://raw.githubusercontent.com/oraylis/datam8/refs/heads/main/docs/assets/images/dm8_incl_text.png" width="300" alt="DataM8 Logo">

# ORAYLIS _DataM8_

_DataM8_ is an exceptional open-source data automation tool available for free!

Its primary goal is to streamline the setup of data warehouses on different platforms, catering to a wide range of users, from small to enterprise-scale data warehouses. Inspired by ORAYLIS' best practices and driven by a passion for data engineering, _DataM8_ focuses on elevating data platform quality while significantly minimizing repetitive tasks. With its expandable solution, users can effortlessly automate data warehouse workflows on their preferred target platform, making it a valuable asset for data engineers and organizations alike.

## Contributors

_DataM8_ is made possible with contributions from the following individuals:

- Michael Kuhlen (ORAYLIS GmbH)
- Lasse Jenzen (ORAYLIS GmbH)
- Jan Degenhardt (ORAYLIS GmbH)
- Markus Riehle (ORAYLIS GmbH)
- Marco Wotruba (ORAYLIS GmbH)
- Philipp Maciercynski (ORAYLIS GmbH)
- Ralph Krieger

To contribute to _DataM8_, follow this contribution and branching 📜[guide](https://github.com/oraylis/datam8/blob/main/docs/contribution.md).

## Issues
Issues are centrally maintained in a different repository

https://github.com/oraylis/datam8

## Documentation

Follow this 📜[guide](https://github.com/oraylis/datam8) for a comprehensive documentation of _DataM8_. This documentation provides detailed information on the architecture, usage, and various features of the tool. Whether you're a newcomer or an experienced user, the documentation will serve as an essential resource for understanding and utilizing _DataM8_ to its fullest potential.

## Requirements to Build this Project

To build and run _DataM8_, you need the following:

1. [Visual Studio 2022](https://visualstudio.microsoft.com/) installed for the data model, frontend, and validator of _DataM8_
1. [datamodel-code-generator](https://pypi.org/project/datamodel-code-generator/) installed via pip: Run `pip install datamodel-code-generator` for the generator of _DataM8_
1. [Python 3.12.x](https://www.python.org/downloads/) for the generator of _DataM8_. Use `.\Dm8PostBuildScript.ps1` to build the generator package and cli for windows
1. [uv](https://docs.astral.sh/uv/getting-started/installation/) to build the Generator. Called with `Dm8PostBuildScript.ps`.
1. [WiX](https://wixtoolset.org/) installed: Run `dotnet tool install --global wix` to package _DataM8_ into an installer

## Mentions

_DataM8_ Frontend utilizes various external libraries and tools, each with its respective licenses. Below is a list of these mentions:

| Reference                                 | Version     | License Type        | License                                                                                      |
| ----------------------------------------- | ----------- | ------------------- | -------------------------------------------------------------------------------------------- |
| AvalonEdit                                | 6.1.3.50    | MIT                 | https://licenses.nuget.org/MIT                                                               |
| Azure.Security.KeyVault.Secrets           | 4.3.0       | MIT                 | https://licenses.nuget.org/MIT                                                               |
| Azure.Storage.Files.DataLake              | 12.11.0     | MIT                 | https://licenses.nuget.org/MIT                                                               |
| CommandLineParser                         | 2.9.1       | License.md          | https://www.nuget.org/packages/CommandLineParser/2.9.1/License                               |
| coverlet.collector                        | 3.1.2       | MIT                 | https://licenses.nuget.org/MIT                                                               |
| DataGridExtensions                        | 2.5.14      | License             | https://www.nuget.org/packages/DataGridExtensions/2.5.14/License                             |
| Dirkster.AvalonDock                       | 4.70.3      | LICENSE             | https://www.nuget.org/packages/Dirkster.AvalonDock/4.70.3/License                            |
| Dirkster.AvalonDock.Themes.Aero           | 4.70.3      | LICENSE             | https://www.nuget.org/packages/Dirkster.AvalonDock.Themes.Aero/4.70.3/License                |
| Dirkster.AvalonDock.Themes.Expression     | 4.70.3      | LICENSE             | https://www.nuget.org/packages/Dirkster.AvalonDock.Themes.Expression/4.70.3/License          |
| Dirkster.AvalonDock.Themes.Metro          | 4.70.3      | LICENSE             | https://www.nuget.org/packages/Dirkster.AvalonDock.Themes.Metro/4.70.3/License               |
| Dirkster.AvalonDock.Themes.VS2013         | 4.70.3      | LICENSE             | https://www.nuget.org/packages/Dirkster.AvalonDock.Themes.VS2013/4.70.3/License              |
| Dirkster.WatermarkControlsLib             | 1.1.0       | MIT                 | https://licenses.nuget.org/MIT                                                               |
| Fluent.Ribbon                             | 9.0.4       | license/License.txt | https://www.nuget.org/packages/Fluent.Ribbon/9.0.4/License                                   |
| Gu.Wpf.Adorners                           | 2.1.1       | MIT                 | https://licenses.nuget.org/MIT                                                               |
| MahApps.Metro                             | 2.4.9       | MIT                 | https://licenses.nuget.org/MIT                                                               |
| MahApps.Metro.IconPacks                   | 4.11.0      | MIT                 | https://licenses.nuget.org/MIT                                                               |
| MahApps.Metro.IconPacks.Modern            | 4.11.0      | MIT                 | https://licenses.nuget.org/MIT                                                               |
| Microsoft.Data.SqlClient                  | 4.1.0       | MIT                 | https://licenses.nuget.org/MIT                                                               |
| Microsoft.Data.SqlClient                  | 5.0.1       | MIT                 | https://licenses.nuget.org/MIT                                                               |
| Microsoft.Extensions.Logging              | 6.0.0       | MIT                 | https://licenses.nuget.org/MIT                                                               |
| Microsoft.Extensions.Logging              | 7.0.0       | MIT                 | https://licenses.nuget.org/MIT                                                               |
| Microsoft.Extensions.Logging.Console      | 7.0.0       | MIT                 | https://licenses.nuget.org/MIT                                                               |
| Microsoft.NET.Test.Sdk                    | 17.2.0      | LICENSE_NET.txt     | https://www.nuget.org/packages/Microsoft.NET.Test.Sdk/17.2.0/License                         |
| Microsoft.SqlServer.DacFx                 | 160.5400.1  | LICENSE.txt         | https://www.nuget.org/packages/Microsoft.SqlServer.DacFx/160.5400.1/License                  |
| Microsoft.SqlServer.Management.SqlParser  | 160.22504.0 | LICENSE.md          | https://www.nuget.org/packages/Microsoft.SqlServer.Management.SqlParser/160.22504.0/License  |
| Microsoft.SqlServer.SqlManagementObjects  | 161.47008.0 | LICENSE.md          | https://www.nuget.org/packages/Microsoft.SqlServer.SqlManagementObjects/161.47008.0/License  |
| Microsoft.Xaml.Behaviors.Wpf              | 1.1.39      | MIT                 | https://licenses.nuget.org/MIT                                                               |
| MSTest.TestAdapter                        | 2.2.10      | MIT                 | https://licenses.nuget.org/MIT                                                               |
| MSTest.TestFramework                      | 2.2.10      | MIT                 | https://licenses.nuget.org/MIT                                                               |
| MvvmDialogs                               | 8.0.0       | Apache-2.0          | https://licenses.nuget.org/Apache-2.0                                                        |
| Newtonsoft.Json                           | 13.0.1      | MIT                 | https://licenses.nuget.org/MIT                                                               |
| Newtonsoft.Json                           | 13.0.3      | MIT                 | https://licenses.nuget.org/MIT                                                               |
| NJsonSchema                               | 10.7.1      | MIT                 | https://licenses.nuget.org/MIT                                                               |
| NJsonSchema.CodeGeneration                | 10.7.1      | MIT                 | https://licenses.nuget.org/MIT                                                               |
| NJsonSchema.CodeGeneration.CSharp         | 10.7.1      | MIT                 | https://licenses.nuget.org/MIT                                                               |
| Parquet.Net                               | 3.9.1       | MIT                 | https://licenses.nuget.org/MIT                                                               |
| PoorMansTSqlFormatterRedux                | 1.0.3       | GNU                 | https://raw.githubusercontent.com/bungeemonkee/PoorMansTSqlFormatterRedux/master/LICENSE.txt |
| Prism.Core                                | 8.1.97      | LICENSE             | https://www.nuget.org/packages/Prism.Core/8.1.97/License                                     |
| Prism.Unity                               | 8.1.97      | LICENSE             | https://www.nuget.org/packages/Prism.Unity/8.1.97/License                                    |
| Prism.Wpf                                 | 8.1.97      | LICENSE             | https://www.nuget.org/packages/Prism.Wpf/8.1.97/License                                      |
| PropertyTools.Wpf                         | 3.1.0       | MIT                 | https://licenses.nuget.org/MIT                                                               |
| ReportGenerator                           | 5.1.9       | Apache-2.0          | https://licenses.nuget.org/Apache-2.0                                                        |
| RestSharp                                 | 107.3.0     | Apache-2.0          | https://licenses.nuget.org/Apache-2.0                                                        |
| System.Collections                        | 4.3.0       | MS-EULA             | http://go.microsoft.com/fwlink/?LinkId=329770                                                |
| System.Collections.NonGeneric             | 4.3.0       | MS-EULA             | http://go.microsoft.com/fwlink/?LinkId=329770                                                |
| System.Composition.AttributedModel        | 6.0.0       | MIT                 | https://licenses.nuget.org/MIT                                                               |
| System.Configuration.ConfigurationManager | 6.0.0       | MIT                 | https://licenses.nuget.org/MIT                                                               |
| System.Runtime.CompilerServices.Unsafe    | 6.0.0       | MIT                 | https://licenses.nuget.org/MIT                                                               |
| WixSharp_wix4                             | 2.0.0       | MIT                 | https://licenses.nuget.org/MIT                                                               |
