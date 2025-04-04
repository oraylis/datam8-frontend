using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Dm8Data.MessageOutput;
using Prism.Events;

namespace Dm8Main.Services
{
    internal class SendOutputEvents : ISendOutputEvents
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
