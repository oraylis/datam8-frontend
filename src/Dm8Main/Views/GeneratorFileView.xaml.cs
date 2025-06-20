﻿/* DataM8
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
using System.Windows.Controls;
using Dm8Main.ViewModels;
using ICSharpCode.AvalonEdit.Search;

namespace Dm8Main.Views
{
    /// <summary>
    /// Interaction logic for ProjectView.xaml
    /// </summary>
    public partial class GeneratorFileView : UserControl, IGeneratorFileView
    {
        [ImportingConstructor]
        public GeneratorFileView(GeneratorFileViewModel projectViewModel)
        {
            this.InitializeComponent();
            this.DataContext = projectViewModel;
            SearchPanel.Install(this.Edit);
        }

        public DocumentViewModelBase ViewModel => (DocumentViewModelBase)this.DataContext;
    }
}
