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

using System;
using System.Collections.ObjectModel;
using System.Composition;
using System.Threading.Tasks;
using Dm8Data.Helper;
using Dm8Data.Validate;
using Dm8Data.Validate.Exceptions;
using Dm8Main.Services;
using MvvmDialogs;
using Prism.Events;
using Unity;

namespace Dm8Main.ViewModels
{
   [Export]
   public class AttributeTypesViewModel:DocumentListViewModel<Dm8Data.AttributeTypes.AttributeType ,
       Dm8Data.AttributeTypes.AttributeTypes>
   {
      #region Property DataTypes

      public ObservableCollection<Dm8Data.DataTypes.DataType> DataTypes
      {
         get => this.dataTypes;
         set => this.SetProperty(ref this.dataTypes ,value);
      }

      private ObservableCollection<Dm8Data.DataTypes.DataType> dataTypes;

      #endregion

      public AttributeTypesViewModel(IUnityContainer container ,ISolutionService solution ,IEventAggregator eventAggregator ,IDialogService dialogService)
          : base(container ,solution ,eventAggregator ,dialogService)
      {
         this.Title = Properties.Resources.Title_AttributeTypes;
      }

      protected override async Task<bool> LoadInternalAsync()
      {
         // read items
         await base.LoadInternalAsync();

         try
         {
            // Read data types
            DataTypeModelReader dataSourceModelReader = new DataTypeModelReader();
            var dataTypes = await dataSourceModelReader.ReadFromFileAsync(this.solution.DataTypesFilePath);
            if (this.DataTypes == null)
            {
               this.DataTypes = new ObservableCollection<Dm8Data.DataTypes.DataType>(dataTypes);
            } else
            {
               this.DataTypes.Update(dataTypes ,(i) => i.Name);
            }
         } catch (Exception ex)
         {
            this.ErrorList.Add(new UnknownValidateException(ex ,this.FilePath));
         }
         return true;
      }
   }
}
