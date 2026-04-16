"""
나만의 AI 학습 조교 에이전트 (My AI Tutor)
- LangChain + OpenAI 기반 RAG 에이전트
- 수업 텍스트(docs/)와 코드(src/) 컨텍스트를 통합 참조
- 대화 메모리로 이전 맥락 유지
"""

import os
import glob
from dotenv import load_dotenv

from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_community.vectorstores import Chroma
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.schema import Document
from langchain.chains import ConversationalRetrievalChain
from langchain.memory import ConversationBufferMemory

load_dotenv()

# ──────────────────────────────────────
# 1. 설정
# ──────────────────────────────────────
DOCS_DIR = os.path.join(os.path.dirname(__file__), "docs")
SRC_DIR = os.path.join(os.path.dirname(__file__), "src")
CHROMA_DIR = os.path.join(os.path.dirname(__file__), ".chroma_db")

LLM_MODEL = os.getenv("LLM_MODEL", "gpt-4o")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

if not OPENAI_API_KEY:
    raise ValueError("OPENAI_API_KEY 환경변수를 설정해주세요. (.env 파일 또는 export)")


# ──────────────────────────────────────
# 2. 문서 로드
# ──────────────────────────────────────
def load_documents():
    """docs/와 src/ 디렉토리에서 모든 텍스트/코드 파일을 로드한다."""
    documents = []

    # 강의 노트 로드 (*.md)
    for filepath in glob.glob(os.path.join(DOCS_DIR, "**", "*.md"), recursive=True):
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
        documents.append(Document(
            page_content=content,
            metadata={"source": filepath, "type": "lecture_note"}
        ))

    # 코드 파일 로드 (*.py, *.js)
    for pattern in ["**/*.py", "**/*.js"]:
        for filepath in glob.glob(os.path.join(SRC_DIR, pattern), recursive=True):
            with open(filepath, "r", encoding="utf-8") as f:
                content = f.read()
            documents.append(Document(
                page_content=content,
                metadata={"source": filepath, "type": "code"}
            ))

    print(f"[로드 완료] 문서 {len(documents)}개 로드됨")
    return documents


# ──────────────────────────────────────
# 3. 벡터 스토어 구축
# ──────────────────────────────────────
def build_vectorstore(documents):
    """문서를 청크로 분할하고 Chroma 벡터 DB에 저장한다."""
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=800,
        chunk_overlap=100,
        separators=["\n## ", "\n### ", "\n\n", "\n", " "]
    )
    chunks = splitter.split_documents(documents)
    print(f"[분할 완료] 청크 {len(chunks)}개 생성됨")

    embeddings = OpenAIEmbeddings(openai_api_key=OPENAI_API_KEY)
    vectorstore = Chroma.from_documents(
        documents=chunks,
        embedding=embeddings,
        persist_directory=CHROMA_DIR,
    )
    print("[벡터 DB] Chroma 벡터 스토어 구축 완료")
    return vectorstore


# ──────────────────────────────────────
# 4. 에이전트 체인 생성
# ──────────────────────────────────────
SYSTEM_PROMPT = """너는 프로그래밍 수업의 전문 조교 AI야.
제공된 수업 노트(docs/)와 실습 코드(src/)를 바탕으로만 답변하며,
모르는 내용은 추측하지 말고 "수업 자료에서 해당 내용을 찾을 수 없습니다"라고 안내해줘.

답변 규칙:
1. 개념 질문: 강의 노트를 참조하여 쉽게 설명
2. 코드 질문: 실습 코드를 인용하며 설명, 코드 블록 사용
3. 연결 질문: 이전 대화 맥락과 새로운 자료를 결합하여 답변
4. 답변은 한국어로 작성
"""


def create_agent(vectorstore):
    """대화형 RAG 에이전트 체인을 생성한다."""
    llm = ChatOpenAI(
        model=LLM_MODEL,
        temperature=0.3,
        openai_api_key=OPENAI_API_KEY,
    )

    memory = ConversationBufferMemory(
        memory_key="chat_history",
        return_messages=True,
        output_key="answer",
    )

    from langchain.prompts import ChatPromptTemplate
    qa_prompt = ChatPromptTemplate.from_messages([
        ("system", SYSTEM_PROMPT + "\n\n참고 자료:\n{context}"),
        ("human", "{question}"),
    ])

    chain = ConversationalRetrievalChain.from_llm(
        llm=llm,
        retriever=vectorstore.as_retriever(search_kwargs={"k": 4}),
        memory=memory,
        return_source_documents=True,
        combine_docs_chain_kwargs={"prompt": qa_prompt},
    )

    return chain, memory


# ──────────────────────────────────────
# 5. 대화 루프
# ──────────────────────────────────────
def format_sources(source_docs):
    """참조 문서 출처를 포맷팅한다."""
    sources = set()
    for doc in source_docs:
        src = doc.metadata.get("source", "알 수 없음")
        src_type = doc.metadata.get("type", "unknown")
        label = "강의노트" if src_type == "lecture_note" else "코드"
        sources.add(f"  [{label}] {os.path.basename(src)}")
    return "\n".join(sorted(sources))


def save_conversation(history, filepath="conversation_log.md"):
    """대화 기록을 마크다운 파일로 저장한다."""
    log_path = os.path.join(os.path.dirname(__file__), filepath)
    with open(log_path, "w", encoding="utf-8") as f:
        f.write("# AI 학습 조교 대화 기록\n\n")
        for entry in history:
            f.write(f"## Q: {entry['question']}\n\n")
            f.write(f"{entry['answer']}\n\n")
            if entry.get("sources"):
                f.write(f"**참조 자료:**\n{entry['sources']}\n\n")
            f.write("---\n\n")
    print(f"\n[저장] 대화 기록이 {log_path}에 저장되었습니다.")


def main():
    print("=" * 60)
    print("  나만의 AI 학습 조교 (My AI Tutor)")
    print("  수업 자료 기반 질의응답 에이전트")
    print("=" * 60)

    # 문서 로드 및 벡터 스토어 구축
    documents = load_documents()
    if not documents:
        print("[오류] docs/ 또는 src/ 디렉토리에 파일이 없습니다.")
        return

    vectorstore = build_vectorstore(documents)
    chain, memory = create_agent(vectorstore)

    conversation_history = []

    print("\n질문을 입력하세요 (종료: quit / 저장: save)\n")

    while True:
        question = input("🧑 질문: ").strip()

        if not question:
            continue
        if question.lower() == "quit":
            break
        if question.lower() == "save":
            save_conversation(conversation_history)
            continue

        try:
            result = chain.invoke({"question": question})
            answer = result["answer"]
            sources = format_sources(result.get("source_documents", []))

            print(f"\n🤖 답변:\n{answer}")
            if sources:
                print(f"\n📚 참조:\n{sources}")
            print()

            conversation_history.append({
                "question": question,
                "answer": answer,
                "sources": sources,
            })

        except Exception as e:
            print(f"\n[오류] {e}\n")

    # 종료 시 자동 저장
    if conversation_history:
        save_conversation(conversation_history)

    print("학습 조교를 종료합니다. 공부 화이팅! 💪")


if __name__ == "__main__":
    main()
