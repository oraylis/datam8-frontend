using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Dm8Data.MessageOutput;
using Microsoft.Extensions.Logging;

namespace Dm8Validate
{
    public class SendValidateOutput : ISendOutputEvents
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
