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
using Dm8Main.Services;
using MvvmDialogs;
using Prism.Events;
using Unity;

namespace Dm8Main.ViewModels
{
   [Export]
   public class DataTypesViewModel:DocumentListViewModel<Dm8Data.DataTypes.DataType ,Dm8Data.DataTypes.DataTypes>
   {
      public DataTypesViewModel(Dm8Data.Solution solution ,IUnityContainer container ,ISolutionService globalSettings ,IEventAggregator eventAggregator ,IDialogService dialogService)
          : base(container ,globalSettings ,eventAggregator ,dialogService)
      {
         this.Title = Properties.Resources.Title_DataTypes;
      }



   }
}
