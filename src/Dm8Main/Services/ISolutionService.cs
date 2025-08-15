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

using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Threading.Tasks;
using Dm8Data.Helper;
using Dm8Data.MessageOutput;
using Dm8Data.Validate;
using Dm8Main.Base;
using Dm8Main.Models;

namespace Dm8Main.Services
{



   public interface ISolutionService:INotifyPropertyChanged
   {
      Dm8Data.Solution Solution { get; set; }

      public GitHelper GitHelper { get; set; }

      public SolutionHelper SolutionHelper { get; set; }

      public ColorTheme Theme { get; set; }

      public string GitPath { get; set; }

      public string GeneratorParameterStage { get; set; }
      public string GeneratorParameterOutput { get; set; }

      public string MsBuildPath { get; set; }

      public string PythonPath { get; set; }

      public IEnumerable<ProjectItem> AllProjectItems { get; }

      public ObservableCollection<ProjectItem> ProjectItems { get; set; }

      public ObservableCollection<string> OutputTypes { get; set; }

      public ObservableCollection<OutputItem> OutputItems { get; set; }

      public ObservableDictionary<string ,OutputText> OutputTexts { get; set; }

      public Task SaveAsync();

      public bool WatcherEnable { get; set; }
      public bool GitActive { get; set; }
   }
}
