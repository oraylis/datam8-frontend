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

using AvalonDock.Layout;

namespace Dm8Main.Avalon
{
   public class LayoutInitializer:ILayoutUpdateStrategy
   {
      public void AfterInsertAnchorable(LayoutRoot layout ,LayoutAnchorable anchorableShown)
      {

      }

      public void AfterInsertDocument(LayoutRoot layout ,LayoutDocument anchorableShown)
      {

      }

      public bool BeforeInsertAnchorable(LayoutRoot layout ,LayoutAnchorable anchorableToShow ,ILayoutContainer destinationContainer)
      {
         return false;
      }

      public bool BeforeInsertDocument(LayoutRoot layout ,LayoutDocument anchorableToShow ,ILayoutContainer destinationContainer)
      {
         return false;
      }

   }
}
