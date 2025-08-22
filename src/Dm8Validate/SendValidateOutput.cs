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

using Dm8Data.MessageOutput;
using Microsoft.Extensions.Logging;

namespace Dm8Validate
{
   public class SendValidateOutput:ISendOutputEvents
   {
      private ILogger logger;

      public bool HasSendError { get; set; }

      public SendValidateOutput(ILogger logger)
      {
         this.logger = logger;
         this.HasSendError = false;
      }

      public void ClearEvents()
      {

      }

      public void SendOutputEvent(OutputItem outputItem)
      {
         if (!string.IsNullOrEmpty(outputItem.Code))
         {
            this.logger.LogError($"[{outputItem.Layer}-{outputItem.Code}] File {outputItem.FilePath} ({outputItem.Line}) - {outputItem.Source}:  {outputItem.Description}");
            this.HasSendError = true;
         }
         else
         {
            this.logger.LogInformation(outputItem.Description);
         }
      }

      public void SendOutputText(OutputItem outputItem)
      {

      }
   }
}
