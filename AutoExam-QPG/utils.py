from tabulate import tabulate
import pandas as pd



def print_first_5_students(df: pd.DataFrame) -> None:
    """
    Print the first 5 rows of the DataFrame in a clean tabular format
    for easier debugging.
    """
    preview_df = df.head(5)  # get top 5 rows
    print(tabulate(preview_df, headers='keys', tablefmt='grid', showindex=False))
    
    
def pretty_print_results(results):
    """
    Pretty prints student classification results in a tabular format.
    
    Args:
        results: List of dictionaries containing student classification data
    """
    import pandas as pd
    from IPython.display import display, HTML
    
    # Create a basic summary dataframe
    summary_data = []
    for student in results:
        summary_data.append({
            'Name': student['name'],
            'Attendance': student['attendance'],
            'Strong Subjects': ', '.join(student['strong_subjects']),
            'Weak Subjects': ', '.join(student['weak_subjects']),
            'Practice Subjects': ', '.join(student['practice_subjects']),
            'Remarks': student['remarks']
        })
    
    summary_df = pd.DataFrame(summary_data)
    
    # Style the summary dataframe
    def highlight_subjects(val):
        if not val:
            return ''
        return 'background-color: #e6ffe6' if 'Strong' in val.name else 'background-color: #ffe6e6'
    
    styled_summary = summary_df.style.applymap(
        lambda x: 'background-color: #e6ffe6' if x else '',
        subset=['Strong Subjects']
    ).applymap(
        lambda x: 'background-color: #ffe6e6' if x else '',
        subset=['Weak Subjects']
    ).applymap(
        lambda x: 'background-color: #fff2cc' if x else '',
        subset=['Practice Subjects']
    )
    
    # Create detailed view for each student
    for i, student in enumerate(results):
        print(f"\n{'='*80}")
        print(f"STUDENT: {student['name']}")
        print(f"{'='*80}")
        print(f"Attendance: {student['attendance']}/26")
        print(f"Remarks: {student['remarks']}")
        print("\nSUBJECT CLASSIFICATION:")
        print(f"  Strong subjects: {', '.join(student['strong_subjects'])}")
        print(f"  Weak subjects: {', '.join(student['weak_subjects'])}")
        print(f"  Practice subjects: {', '.join(student['practice_subjects'])}")
        
        if student['weak_topics']:
            print("\nWEAK TOPICS:")
            for topic in student['weak_topics']:
                print(f"  • {topic}")
        
        print("\nTEST DETAILS:")
        test_df = pd.DataFrame(student['test_details'])
        test_df = test_df.rename(columns={
            'subject': 'Subject',
            'marks_raw': 'Raw Marks',
            'percentage': 'Percentage',
            'topics': 'Topics'
        })
        test_df['Percentage'] = test_df['Percentage'].apply(lambda x: f"{x:.2f}%" if pd.notna(x) else 'N/A')
        test_df['Topics'] = test_df['Topics'].apply(lambda x: ', '.join(x) if x else 'N/A')
        
        # Style the test details dataframe
        def highlight_percentage(val):
            if not isinstance(val, str) or val == 'N/A':
                return ''
            
            pct = float(val.rstrip('%'))
            if pct >= 85:
                return 'background-color: #e6ffe6'
            elif pct < 70:
                return 'background-color: #ffe6e6'
            else:
                return 'background-color: #fff2cc'
        
        styled_test_df = test_df.style.applymap(highlight_percentage, subset=['Percentage'])
        display(styled_test_df)
        
        if i < len(results) - 1:
            print("\n" + "-"*80)
    
    print("\n\nSUMMARY TABLE:")
    display(styled_summary)
    
    # Return both styled dataframes for further use if needed
    return styled_summary, test_df

def print_single_value_in_table(label: str, value) -> None:
    """
    Prints a mini two-column table:
    ┌──────────────┬────────┐
    │ Label        │ Value  │
    └──────────────┴────────┘
    """
    key = label.strip().capitalize()
    val = str(value)
    w1 = max(len(key), 4)
    w2 = max(len(val), 5)
    print(f"┌{'─'*w1}┬{'─'*w2}┐")
    print(f"│{key:^{w1}}│{val:^{w2}}│")
    print(f"└{'─'*w1}┴{'─'*w2}┘")
    
def err_box_red(label: str, message) -> None:
    """
    Prints a mini two-column box around the error, rendered in red.
    """
    # Prepare content
    key = label.strip().capitalize()
    val = str(message)
    w1, w2 = len(key), len(val)

    # ANSI codes
    RED = "\033[31m"
    RESET = "\033[0m"

    # Build lines
    top =   f"┌{'─'*w1}┬{'─'*w2}┐"
    mid =   f"│{key:^{w1}}│{val:^{w2}}│"
    bottom =f"└{'─'*w1}┴{'─'*w2}┘"

    # Print in red
    print(f"{RED}{top}{RESET}")
    print(f"{RED}{mid}{RESET}")
    print(f"{RED}{bottom}{RESET}")
    
import textwrap
from typing import List, Dict, Any

def print_question_data(
    data: List[Dict[str, List[Any]]],
    width: int = 80
) -> None:
    """
    Pretty‐print nested question data.

    Args:
        data: List of dicts, each mapping a section title to a list of questions.
        width: Maximum line width for wrapping question text.
    """
    for section in data:
        for title, qs in section.items():
            header = title.strip().upper()
            print(f"\n{header}\n{'=' * len(header)}")
            for i, q in enumerate(qs, 1):
                # collapse newlines and excess whitespace
                text = " ".join(line.strip() for line in str(q).splitlines())
                wrapped = textwrap.fill(text, width=width)
                print(f"\n{i}. {wrapped}")
            print()  # extra space before next section