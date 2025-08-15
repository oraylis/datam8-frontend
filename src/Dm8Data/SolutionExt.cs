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

using System.IO;
using Dm8Data.Properties;
using Newtonsoft.Json;

namespace Dm8Data
{
   public partial class Solution:Prism.Mvvm.BindableBase
   {
      private string solutionFile;

      [JsonIgnore]
      public string SolutionFile
      {
         get => this.solutionFile;
         set => SetProperty(ref this.solutionFile ,value);
      }

      [Newtonsoft.Json.JsonIgnore]
      public string Name => Path.GetFileNameWithoutExtension(this.solutionFile);

      [Newtonsoft.Json.JsonIgnore]
      public string CurrentRootFolder { get; set; }

      [Newtonsoft.Json.JsonIgnore]
      public string BaseFilePath => Path.Combine(this.CurrentRootFolder ,this.BasePath ?? Resources.Solution_BaseFilePath);

      [Newtonsoft.Json.JsonIgnore]
      public string RawFolderPath => Path.Combine(this.CurrentRootFolder ,this.RawPath ?? Resources.Solution_RawFolderPath);

      [Newtonsoft.Json.JsonIgnore]
      public string GenerateFolderPath => Path.Combine(this.CurrentRootFolder ,this.GeneratePath ?? Resources.Solution_GenerateFolderPath);

      [Newtonsoft.Json.JsonIgnore]
      public string StagingFolderPath => Path.Combine(this.CurrentRootFolder ,this.StagingPath ?? Resources.Solution_StagingFolderPath);

      [Newtonsoft.Json.JsonIgnore]
      public string CoreFolderPath => Path.Combine(this.CurrentRootFolder ,this.CorePath ?? Resources.Solution_CoreFolderPath);

      [Newtonsoft.Json.JsonIgnore]
      public string CuratedFolderPath => Path.Combine(this.CurrentRootFolder ,this.CuratedPath ?? Resources.Solution_CuratedFolderPath);

      [Newtonsoft.Json.JsonIgnore]
      public string DiagramFolderPath => Path.Combine(this.CurrentRootFolder ,this.DiagramPath ?? Resources.Solution_DiagramFolderPath);

      [Newtonsoft.Json.JsonIgnore]
      public string OutputFolderPath => Path.Combine(this.CurrentRootFolder ,this.OutputPath ?? Resources.Solution_OutputFolderPath);

      [Newtonsoft.Json.JsonIgnore]
      public string DataTypesFilePath => Path.Combine(this.CurrentRootFolder ,this.BasePath ,Resources.Solution_DataTypesFilePath_DataTypes_json);

      [Newtonsoft.Json.JsonIgnore]
      public string AttributeTypesFilePath => Path.Combine(this.CurrentRootFolder ,this.BasePath ,Resources.Solution_AttributeTypesFilePath_AttributeTypes_json);

      [Newtonsoft.Json.JsonIgnore]
      public string DataSourcesFilePath => Path.Combine(this.CurrentRootFolder ,this.BasePath ,Resources.Solution_DataSourcesFilePath_DataSources_json);

      [Newtonsoft.Json.JsonIgnore]
      public string DataProductsFilePath => Path.Combine(this.CurrentRootFolder ,this.BasePath ,Resources.Solution_DataProductsFilePath_DataProducts_json);

      [Newtonsoft.Json.JsonIgnore]
      public string DataModulesFilePath => Path.Combine(this.CurrentRootFolder ,this.BasePath ,Resources.Solution_DataModulesFilePath_DataModules_json);

   }
}
