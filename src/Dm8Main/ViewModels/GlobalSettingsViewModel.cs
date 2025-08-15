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

using System.Composition;
using System.Threading.Tasks;
using Dm8Main.Services;

namespace Dm8Main.ViewModels
{
   [Export]
   public class GlobalSettingsViewModel:AnchorViewModel
   {
      #region Property GlobalSettings
      public ISolutionService GlobalSettings
      {
         get => this.globalSettings;
         set => this.SetProperty(ref this.globalSettings ,value);
      }

      public ISolutionService globalSettings;
      #endregion

      public GlobalSettingsViewModel(ISolutionService solutionService)
      {
         this.Title = "Global Settings";
         this.GlobalSettings = solutionService;
      }

#pragma warning disable CS1998 // Async method lacks 'await' operators and will run synchronously
      public override async Task SaveAsync()
      {
         await this.GlobalSettings.SaveAsync();
      }

   }
}
