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
