using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Dm8Data.MessageOutput
{
    public interface ISendOutputEvents
    {
        void ClearEvents();

        void SendOutputEvent(OutputItem outputItem);

        void SendOutputText(OutputItem outputItem);
    }
}
