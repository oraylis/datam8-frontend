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

using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Text;

namespace Dm8Main.Models;

public class SourceMapping : Prism.Mvvm.BindableBase
{
    #region Property IsChecked
    public bool IsChecked
    {
        get => this.isChecked;
        set => this.SetProperty(ref this.isChecked, value);
    }

    private bool isChecked;
    #endregion

    #region Property StageModel
    public Dm8Data.Stage.ModelEntry StageModel
    {
        get => this.stageModel;
        set => this.SetProperty(ref this.stageModel, value);
    }

    private Dm8Data.Stage.ModelEntry stageModel;
    #endregion

    #region Property SourceEntity
    public Dm8Data.Core.SourceEntity SourceEntity
    {
        set => this.SetProperty(ref this.sourceEntity, value);
        get => this.sourceEntity;
    }

    private Dm8Data.Core.SourceEntity sourceEntity;
    #endregion


}