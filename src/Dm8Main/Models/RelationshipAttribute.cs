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

namespace Dm8Main.Models;

public class RelationshipAttribute : Prism.Mvvm.BindableBase
{
    #region Property Attribute
    public Dm8Data.Core.Attribute Attribute
    {
        get => this.attribute;
        set => this.SetProperty(ref this.attribute, value);
    }

    private Dm8Data.Core.Attribute attribute;
    #endregion

    #region Property Relationship
    public Dm8Data.Core.Relationship Relationship
    {
        get => this.relationship;
        set => this.SetProperty(ref this.relationship, value);
    }

    private Dm8Data.Core.Relationship relationship;
    #endregion
}