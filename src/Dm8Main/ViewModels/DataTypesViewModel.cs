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
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Composition;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using Dm8Data;
using Dm8Main.Models;
using Dm8Main.Services;
using Newtonsoft.Json;
using NJsonSchema.CodeGeneration.CSharp;
using Prism.Commands;
using Prism.Events;
using MvvmDialogs;
using Unity;

namespace Dm8Main.ViewModels
{
    [Export]
    public class DataTypesViewModel : DocumentListViewModel<Dm8Data.DataTypes.DataType, Dm8Data.DataTypes.DataTypes>
    {
        public DataTypesViewModel(Dm8Data.Solution solution, IUnityContainer container, ISolutionService globalSettings, IEventAggregator eventAggregator, IDialogService dialogService)
            : base(container, globalSettings, eventAggregator, dialogService)
        {
            this.Title = Properties.Resources.Title_DataTypes;
        }



    }
}
