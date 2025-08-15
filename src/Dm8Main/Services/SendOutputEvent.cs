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
using Dm8Data.MessageOutput;
using Prism.Events;

namespace Dm8Main.Services
{
   internal class SendOutputEvents:ISendOutputEvents
   {
      // Connection to UI
      private readonly IEventAggregator eventAggregator;

      public SendOutputEvents(IEventAggregator eventAggregator)
      {
         this.eventAggregator = eventAggregator;
      }

      public void ClearEvents()
      {
         // Clear output
         this.eventAggregator.GetEvent<OutputItemClearEvent>().Publish("*");
      }

      public void SendOutputEvent(OutputItem outputItem)
      {
         this.eventAggregator.GetEvent<OutputItemEvent>().Publish(outputItem);

      }

      public void SendOutputText(OutputItem outputItem)
      {
         throw new NotImplementedException();
      }
   }
}
