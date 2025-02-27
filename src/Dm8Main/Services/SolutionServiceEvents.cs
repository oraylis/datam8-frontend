using System.Collections.Generic;
using System.Text;
using Dm8Data.Helper;
using Dm8Data.MessageOutput;
using Dm8Main.Models;
using Dm8Main.ViewModels;
using Prism.Events;

namespace Dm8Main.Services
{
    public class OpenSolution : PubSubEvent<Dm8Data.Solution> { }

    public class OpenLayout : PubSubEvent<Dm8Data.Solution> { }

    public class RefreshSolution : PubSubEvent<Dm8Data.Solution> { }

    public class SaveSolution : PubSubEvent<Dm8Data.Solution> { }

    public class SaveLayout : PubSubEvent<Dm8Data.Solution> { }

    public class NewDocumentEvent : PubSubEvent<KeyValuePair<ProjectItem, ProjectItem.Types>> { }

    public class SelectDocumentEvent : PubSubEvent<ProjectItem> { }

    public class OpenDocumentEvent : PubSubEvent<ProjectItem> { }

    public class OpenDocumentsEvent : PubSubEvent<ProjectItem> { }

    public class EditObjectNameEvent : PubSubEvent<ProjectItem> { }

    public class RenameObjectEvent : PubSubEvent<RenameObjectArgs> { }

    public class DeleteObjectEvent : PubSubEvent<ProjectItem> { }

    public class OutputLineEvent : PubSubEvent<KeyValuePair<string, string>> { }

    public class OutputLineEventEx : PubSubEvent<KeyValuePair<string, StringBuilder>> { }

    public class OutputItemEvent : PubSubEvent<OutputItem> { }

    public class OutputItemClearEvent : PubSubEvent<string> { }    

    public class FileChangeEvent : PubSubEvent<string> { }

    public class GitChangeEvent : PubSubEvent<GitHelper> { }

}
