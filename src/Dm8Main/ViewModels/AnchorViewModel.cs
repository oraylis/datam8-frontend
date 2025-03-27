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
using System.Composition;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Prism.Commands;

namespace Dm8Main.ViewModels
{
    [Export]
    public abstract class AnchorViewModel : ViewModelBase
    {
        public event Action Closed;

        #region Property HideCommand
        public DelegateCommand HideCommand
        {
            get => this.hideCommand;
            set => this.SetProperty(ref this.hideCommand, value);
        }

        public DelegateCommand hideCommand;

        #endregion

        public AnchorViewModel()
        {
            this.Closed += this.AnchorViewModel_Closed;
            this.HideCommand = new DelegateCommand(() => this.Hide());
            this.IsModified = false;
        }

        private void AnchorViewModel_Closed()
        {

        }

        private void Hide()
        {
            this.Closed.Invoke();
        }

        public abstract Task SaveAsync();
    }
}
