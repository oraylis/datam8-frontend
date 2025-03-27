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
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using Dm8Main.Base;
using Prism.Commands;

namespace Dm8Main.Views
{
    public class MainWindowBase : MahApps.Metro.Controls.MetroWindow
    {
        #region Dependency Properties for Theme
        public ColorTheme Theme
        {
            get => (ColorTheme)this.GetValue(ThemeProperty);
            set => this.SetValue(ThemeProperty, value);
        }

        public static readonly DependencyProperty ThemeProperty =
            DependencyProperty.Register("Theme", typeof(ColorTheme), typeof(MainWindowBase), new PropertyMetadata((d, e) => (d as MainWindowBase).ThemeChanged(e)));


        public virtual void ThemeChanged(DependencyPropertyChangedEventArgs e)
        {
        }
        #endregion

        #region DelegateCommand
        public DelegateCommand<AvalonDock.DocumentClosingEventArgs> DocumentClosingCommand
        {
            get => (DelegateCommand<AvalonDock.DocumentClosingEventArgs>)this.GetValue(DocumentClosingCommandProperty);
            set => this.SetValue(DocumentClosingCommandProperty, value);
        }

        // Using a DependencyProperty as the backing store for DocumentClosingCommand.  This enables animation, styling, binding, etc...
        public static readonly DependencyProperty DocumentClosingCommandProperty =
            DependencyProperty.Register("DocumentClosingCommand", typeof(DelegateCommand<AvalonDock.DocumentClosingEventArgs>), typeof(MainWindowBase), new PropertyMetadata(null));
        #endregion
    }
}
